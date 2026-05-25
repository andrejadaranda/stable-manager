// Public read-only beacon viewer (Sprint 4 W3).
// Anonymous. Token is the only credential.
// Server-renders the bootstrap payload via resolve_live_share, then
// hands off to <BeaconViewer> which polls every 7s.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { BeaconViewer } from "./viewer";
import type { BeaconBootstrap } from "@/services/liveSessionShares.pure";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,80}$/;

export default async function BeaconPage({ params }: { params: { token: string } }) {
  if (!TOKEN_RE.test(params.token)) {
    return <InvalidBeacon reason="malformed" />;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("resolve_live_share", { p_token: params.token });
  if (error || !data) {
    const code = ((error?.message ?? "") as string).replace(/^ERROR:\s*/, "").trim();
    return <InvalidBeacon reason={code} />;
  }

  const bootstrap = data as BeaconBootstrap;

  return (
    <div className="min-h-screen bg-ink-950 text-cream-50">
      <BeaconViewer token={params.token} bootstrap={bootstrap} />
    </div>
  );
}

function InvalidBeacon({ reason }: { reason: string }) {
  const friendly =
    reason === "TOKEN_EXPIRED"   ? "This safety beacon expired. The ride is over."
    : reason === "TOKEN_REVOKED"  ? "The rider revoked this beacon."
    : reason === "TOKEN_NOT_FOUND" ? "We don't recognise this beacon link."
    : "This beacon link looks invalid.";
  return (
    <div className="min-h-screen bg-cream-50 px-4 py-10">
      <div className="mx-auto max-w-md flex flex-col gap-4 text-center">
        <p className="font-display text-xl text-navy-700">
          Longrein<span className="text-saddle-700">.</span>
        </p>
        <div className="bg-white border border-ink-100 rounded-2xl shadow-soft p-6">
          <h1 className="font-display text-xl text-navy-900">Beacon not active</h1>
          <p className="text-sm text-ink-600 mt-2">{friendly}</p>
        </div>
      </div>
    </div>
  );
}
