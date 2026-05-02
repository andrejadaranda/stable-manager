// POST /api/waitlist — public email capture for the marketing landing.
//
// Validates email shape, writes to waitlist_signups via the anon
// Supabase client (RLS allows insert-only, no select). Idempotent on
// duplicate email — same address submitted twice returns ok=true,
// no error, so the user never sees "already on the list" friction.
//
// Honeypot field "company" — if a bot fills it, we silently drop the
// request and return ok=true to keep the bot from learning.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const runtime = "edge";

export async function POST(req: Request) {
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
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot
  if (payload.company && payload.company.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const email = (payload.email ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email." }, { status: 400 });
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
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "Could not save your email. Try again in a moment." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
