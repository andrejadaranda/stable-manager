// Refreshes the Supabase session cookie on every request and gates app routes.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n: string) => request.cookies.get(n)?.value,
        set: (n: string, v: string, o: CookieOptions) => {
          request.cookies.set({ name: n, value: v, ...o });
          response.cookies.set({ name: n, value: v, ...o });
        },
        remove: (n: string, o: CookieOptions) => {
          request.cookies.set({ name: n, value: "", ...o });
          response.cookies.set({ name: n, value: "", ...o });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Gate the app — anything under /dashboard requires auth.
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard");
  const isLoginOrSignup = path.startsWith("/login") || path.startsWith("/signup");

  // /auth/* (callback, check-email, error) must be reachable in any session
  // state. The confirmation link IS visited while signed-out, but the
  // confirmation flow may also need to run for an already-signed-in user
  // (e.g. switching email) — so never redirect away from /auth/*.
  const isAuthFlow = path.startsWith("/auth/");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (isLoginOrSignup && user && !isAuthFlow) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // -----------------------------------------------------------------
  // Subscription gate — block /dashboard/* (except billing) for users
  // whose stable has no active subscription.
  //
  // Rationale: without this, a signed-up user could use the entire app
  // without ever entering a card — free-loophole. The /dashboard/settings/billing
  // page itself must be reachable, otherwise they cannot fix the gating.
  //
  // Status whitelist:
  //   - 'trialing'  → 14-day card-required trial in progress
  //   - 'active'    → paying (or Founding 15 manual-billed)
  //
  // Status block-list (anything not in whitelist):
  //   - 'past_due', 'unpaid', 'cancelled', 'incomplete' → redirect to billing
  //   - missing row → redirect to billing (shouldn't happen post-signup, but
  //     belt-and-braces)
  //
  // We intentionally do NOT call /api/* here — that's where the billing
  // status comes FROM. Write-protection on API routes is a separate concern
  // (see #LAYER-4 in the launch-readiness notes); this layer just prevents
  // browsing the app UI without a valid subscription.
  // -----------------------------------------------------------------
  const isDashboard = path.startsWith("/dashboard");
  const isBillingPage = path.startsWith("/dashboard/settings/billing");
  const isPersonalCheckoutWait = path.startsWith("/dashboard/personal-checkout");
  if (isDashboard && !isBillingPage && !isPersonalCheckoutWait && user) {
    // Look up the user's stable_id + role + stable.account_type. Two
    // queries instead of one join because Supabase ssr client doesn't
    // play nicely with nested selects on RLS-protected views from
    // middleware.
    const { data: profile } = await supabase
      .from("profiles")
      .select("stable_id, role, stable:stables(account_type)")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profile?.stable_id) {
      // User without a profile — shouldn't happen, but if it does, send them
      // to billing where they'll either complete signup or see a clear error.
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/settings/billing";
      url.searchParams.set("gated", "no-profile");
      return NextResponse.redirect(url);
    }

    // Subscription gate applies to STABLE OWNERS only. Employees and
    // clients don't pay — the stable owner pays for the workspace they
    // belong to, so gating their access would just produce an infinite
    // redirect loop (they have no way to fix the gating themselves).
    if (profile.role === "owner") {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("stable_id", profile.stable_id)
        .maybeSingle();

      // Defense-in-depth: 'trialing' alone is not enough — also verify the
      // trial window hasn't lapsed. Without this check, an account whose
      // Stripe subscription never got attached (stale trial row) could
      // browse the app indefinitely past the trial end date, bypassing
      // the paywall. 'active' is always allowed (Stripe webhook tracks
      // renewals + flips to past_due/cancelled when needed).
      const now = Date.now();
      const trialOk =
        sub?.status === "trialing" &&
        sub?.current_period_end != null &&
        new Date(sub.current_period_end).getTime() > now;
      const allowed = trialOk || sub?.status === "active";
      if (!allowed) {
        // Personal accounts skip the business /settings/billing page —
        // they go straight to /dashboard/personal-checkout which fires
        // /api/stripe/checkout/personal and redirects to Stripe Checkout.
        const stableJoin = Array.isArray((profile as { stable?: unknown }).stable)
          ? (profile as { stable: Array<{ account_type?: string }> }).stable[0]
          : (profile as { stable?: { account_type?: string } }).stable;
        const isPersonal = stableJoin?.account_type === "personal";

        const url = request.nextUrl.clone();
        url.pathname = isPersonal
          ? "/dashboard/personal-checkout"
          : "/dashboard/settings/billing";
        // Reason hint for the billing UI so it can show the right copy:
        //   trial-expired → had a trial, it lapsed without a card
        //   <status>      → past_due / unpaid / cancelled / incomplete
        //   no-subscription → never had a row
        const gatedReason = sub?.status === "trialing"
          ? "trial-expired"
          : (sub?.status ?? "no-subscription");
        url.searchParams.set("gated", gatedReason);
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/public).*)"],
};
