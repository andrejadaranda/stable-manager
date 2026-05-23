// Supabase email-confirmation landing route.
//
// The link inside the confirmation email points here with `?code=...`.
// We exchange the code for a session, then — if the user has no profile
// yet — finish provisioning their stable from user_metadata. Finally we
// redirect them into the app.
//
// Failure modes are routed to /auth/error with a `reason` param so the user
// gets a clear message instead of a blank page.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  // Supabase sometimes signals failure inline (expired link, etc.).
  const errorParam = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  if (errorParam) {
    return NextResponse.redirect(
      buildErrorUrl(url, errorDescription ?? errorParam),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      buildErrorUrl(url, "Missing confirmation code."),
    );
  }

  // We need a response we can attach Set-Cookie headers to BEFORE redirecting,
  // so we build it up as we go.
  const response = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );
  if (exchangeError) {
    return NextResponse.redirect(buildErrorUrl(url, exchangeError.message));
  }

  // Confirmation succeeded — make sure the user has a profile.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profile) {
      // First confirmation — finish the signup that started before the email.
      const meta = (user.user_metadata ?? {}) as {
        account_type?: "personal" | "business";
        stable_name?: string;
        stable_slug?: string;
        full_name?: string;
        personal_plan_tier?: "mini" | "plus";
      };
      if (meta.account_type === "personal" && meta.full_name && meta.personal_plan_tier) {
        const { error: provisionError } = await supabase.rpc(
          "provision_personal_account",
          {
            p_full_name: meta.full_name,
            p_plan_tier: meta.personal_plan_tier,
          },
        );
        if (provisionError) {
          return NextResponse.redirect(
            buildErrorUrl(url, provisionError.message),
          );
        }
      } else if (meta.stable_name && meta.stable_slug && meta.full_name) {
        const { error: provisionError } = await supabase.rpc(
          "provision_stable",
          {
            p_stable_name: meta.stable_name,
            p_stable_slug: meta.stable_slug,
            p_full_name: meta.full_name,
          },
        );
        if (provisionError) {
          return NextResponse.redirect(
            buildErrorUrl(url, provisionError.message),
          );
        }
      }
      // No metadata = an invited user attaching themselves; they don't need
      // provision_stable here, the inviter already did attach_user_to_stable.
    }
  }

  return response;
}

function buildErrorUrl(currentUrl: URL, reason: string): URL {
  const u = new URL("/auth/error", currentUrl.origin);
  u.searchParams.set("reason", reason);
  return u;
}
