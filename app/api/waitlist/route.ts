// POST /api/waitlist — public email capture for the marketing landing.
//
// Validates email shape, writes to waitlist_signups via the anon
// Supabase client (RLS allows insert-only, no select). Idempotent on
// duplicate email — same address submitted twice returns ok=true,
// no error, so the user never sees "already on the list" friction.
//
// Honeypot field "company" — if a bot fills it, we silently drop the
// request and return ok=true to keep the bot from learning.
//
// CORS: Allowed origins below match the apex landing domain. The
// landing static site (deployed at longrein.eu) fetches this endpoint
// cross-origin, so the OPTIONS preflight + Access-Control-Allow-Origin
// header are required. The Next.js app itself (app.longrein.eu) calls
// this same endpoint same-origin and is unaffected.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Origins allowed to POST to this endpoint cross-domain.
const ALLOWED_ORIGINS = new Set<string>([
  "https://longrein.eu",
  "https://www.longrein.eu",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  // Echo back the requesting origin only if it's in the allowlist.
  // Otherwise omit the header — browsers will block the request.
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  };
}

export const runtime = "edge";

export async function OPTIONS(req: Request) {
  // CORS preflight. Browsers fire this before the actual POST.
  return new Response(null, {
    status:  204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: Request) {
  const origin  = req.headers.get("origin");
  const headers = corsHeaders(origin);

  let payload: {
    email?: string;
    source?: string;
    yard_size?: string;
    country?: string;
    company?: string; // honeypot
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400, headers },
    );
  }

  // Honeypot
  if (payload.company && payload.company.trim().length > 0) {
    return NextResponse.json({ ok: true }, { headers });
  }

  const email = (payload.email ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email." },
      { status: 400, headers },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, detectSessionInUrl: false },
  });

  const { error } = await supabase.from("waitlist_signups").insert({
    email,
    source:    payload.source ?? "landing",
    yard_size: payload.yard_size ?? null,
    country:   payload.country ?? null,
    ip,
    user_agent: ua,
  });

  if (error) {
    // 23505 = unique violation. Treat as success — we don't want to
    // expose whether the email is already on the list.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true }, { headers });
    }
    return NextResponse.json(
      { ok: false, error: "Could not save your email. Try again in a moment." },
      { status: 500, headers },
    );
  }

  return NextResponse.json({ ok: true }, { headers });
}
