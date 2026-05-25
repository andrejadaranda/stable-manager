// Anonymous poll endpoint for the beacon viewer.
// Wraps the SECURITY DEFINER poll_live_share RPC so the public page
// can fetch incremental track points without bundling supabase-js.

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,80}$/;

export async function GET(
  req: Request,
  { params }: { params: { token: string } },
): Promise<Response> {
  if (!TOKEN_RE.test(params.token)) {
    return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 404 });
  }

  const url = new URL(req.url);
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? sinceRaw : null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("poll_live_share", {
    p_token: params.token,
    p_since: since,
  });

  if (error) {
    const raw = (error.message ?? "").replace(/^ERROR:\s*/, "").trim();
    return NextResponse.json({ ok: false, error: raw || "poll_failed" }, { status: 410 });
  }
  return NextResponse.json(data, {
    headers: { "cache-control": "no-store" },
  });
}
