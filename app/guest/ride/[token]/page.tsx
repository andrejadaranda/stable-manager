// Public, no-auth route. A guest rider opens this from the link the horse
// owner shared. They see whose horse + which stable, fill a few fields, and
// log the ride. The SECURITY DEFINER RPC handles all auth + rate limiting.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { GuestRideForm } from "./form";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,80}$/;

type Resolved = {
  ok:               true;
  horse_name:       string;
  stable_name:      string;
  kind:             "vet" | "farrier" | "rider";
  contributor_name: string;
  expires_at:       string;
};

export default async function GuestRidePage({ params }: { params: { token: string } }) {
  if (!TOKEN_RE.test(params.token)) return <InvalidLink reason="malformed" />;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("resolve_guest_token", { p_token: params.token });
  if (error || !data) {
    const code = ((error?.message ?? "") as string).replace(/^ERROR:\s*/, "").trim();
    return <InvalidLink reason={code} />;
  }

  const ctx = data as Resolved;
  if (ctx.kind !== "rider") return <InvalidLink reason="WRONG_KIND" />;

  const expiresLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(ctx.expires_at));

  return (
    <div className="min-h-screen bg-cream-50 px-4 py-10">
      <div className="mx-auto max-w-md flex flex-col gap-6">
        <header className="text-center">
          <p className="font-display text-xl text-navy-700">
            Longrein<span className="text-saddle-700">.</span>
          </p>
        </header>

        <div className="bg-white rounded-2xl shadow-soft p-6 flex flex-col gap-5">
          <div>
            <h1 className="font-display text-2xl text-navy-900">Log a ride</h1>
            <p className="text-sm text-ink-600 mt-1.5 leading-relaxed">
              You&apos;re logging a ride on <strong className="text-ink-900">{ctx.horse_name}</strong>{" "}
              at {ctx.stable_name}, as <strong className="text-ink-900">{ctx.contributor_name}</strong>.
              No account needed — the owner sees it on the horse&apos;s record.
            </p>
          </div>

          <GuestRideForm token={params.token} horseName={ctx.horse_name} />

          <p className="text-[11px] text-ink-400 text-center">
            This link works until {expiresLabel}. The owner can revoke it anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const copy =
    reason === "TOKEN_EXPIRED" ? "This link has expired. Ask the horse owner for a new one."
    : reason === "TOKEN_REVOKED" ? "The horse owner revoked this link."
    : reason === "WRONG_KIND" ? "This link isn't a ride-logging link."
    : "This link is invalid or no longer works.";
  return (
    <div className="min-h-screen bg-cream-50 px-4 py-10 flex items-start justify-center">
      <div className="mx-auto max-w-md w-full bg-white rounded-2xl shadow-soft p-6 text-center mt-10">
        <p className="font-display text-xl text-navy-700 mb-4">
          Longrein<span className="text-saddle-700">.</span>
        </p>
        <p className="text-sm text-ink-700">{copy}</p>
      </div>
    </div>
  );
}
