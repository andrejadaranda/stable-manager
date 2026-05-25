// Public, no-auth route. Vet / farrier opens this from the
// shareable link the stable owner sent them. They see whose horse +
// which stable + what kind of event they're recording, fill 3-5
// fields, submit. The SECURITY DEFINER RPC handles all auth.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { GuestLogForm } from "./form";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,80}$/;

type Resolved = {
  ok:               true;
  horse_name:       string;
  stable_name:      string;
  kind:             "vet" | "farrier";
  contributor_name: string;
  expires_at:       string;
};

export default async function GuestLogPage({ params }: { params: { token: string } }) {
  if (!TOKEN_RE.test(params.token)) {
    return <InvalidLink reason="malformed" />;
  }

  // Admin client because the visitor is anonymous; RPC is token-gated.
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("resolve_guest_token", { p_token: params.token });

  if (error || !data) {
    const code = ((error?.message ?? "") as string).replace(/^ERROR:\s*/, "").trim();
    return <InvalidLink reason={code} />;
  }

  const ctx = data as Resolved;
  const kindLabel = ctx.kind === "vet" ? "vet visit" : "farrier visit";
  const expires = new Date(ctx.expires_at);
  const expiresLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(expires);

  return (
    <div className="min-h-screen bg-cream-50 px-4 py-10">
      <div className="mx-auto max-w-md flex flex-col gap-6">
        <header className="text-center">
          <p className="font-display text-xl text-navy-700">
            Longrein<span className="text-saddle-700">.</span>
          </p>
        </header>

        <section className="bg-white border border-ink-100 rounded-2xl shadow-soft p-6 flex flex-col gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
              {ctx.stable_name}
            </p>
            <h1 className="font-display text-2xl text-navy-900 mt-1">
              Log a {kindLabel} for {ctx.horse_name}
            </h1>
            <p className="text-sm text-ink-600 mt-2 leading-relaxed">
              Hi {ctx.contributor_name} — fill in what you did today. The stable team
              will see it in {ctx.horse_name}'s health log immediately, and they'll get
              a reminder when the next visit is due.
            </p>
          </div>

          <GuestLogForm token={params.token} kindLabel={kindLabel} />

          <p className="text-[11px] text-ink-500 text-center">
            This link works until <strong>{expiresLabel}</strong>. The stable can revoke it any time.
          </p>
        </section>

        <p className="text-center text-[11px] text-ink-500">
          Powered by Longrein · the stable management platform · <a href="https://longrein.eu" className="underline">longrein.eu</a>
        </p>
      </div>
    </div>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const friendly =
    reason === "TOKEN_EXPIRED"  ? "This link has expired. Ask the stable to send you a new one."
    : reason === "TOKEN_REVOKED" ? "The stable owner revoked this link."
    : reason === "TOKEN_NOT_FOUND" ? "This link doesn't match anything we have on file."
    : "This link looks invalid.";

  return (
    <div className="min-h-screen bg-cream-50 px-4 py-10">
      <div className="mx-auto max-w-md flex flex-col gap-6">
        <header className="text-center">
          <p className="font-display text-xl text-navy-700">
            Longrein<span className="text-saddle-700">.</span>
          </p>
        </header>
        <section className="bg-white border border-ink-100 rounded-2xl shadow-soft p-6 text-center">
          <h1 className="font-display text-xl text-navy-900">Link not usable</h1>
          <p className="text-sm text-ink-600 mt-2">{friendly}</p>
        </section>
      </div>
    </div>
  );
}
