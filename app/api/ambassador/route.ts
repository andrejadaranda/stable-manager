// POST /api/ambassador — public ambassador application capture.
//
// Stores one row in ambassador_applications via the anon Supabase
// client (RLS allows insert-only, no select). Honeypot field "company"
// silently drops bots. CORS allowlists the apex landing domain so the
// static site at longrein.eu can post cross-origin.
//
// Mirrors app/api/waitlist for consistency.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const ALLOWED_ORIGINS = new Set<string>([
  "https://longrein.eu",
  "https://www.longrein.eu",
]);

function corsHeaders(origin: string | null): Record<string, string> {
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
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

type Payload = {
  full_name?: string;
  email?: string;
  country?: string;
  horses?: string;
  discipline?: string;
  describes?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  youtube?: string;
  other_links?: string;
  audience?: string;
  community_type?: string;
  community_size?: string;
  support?: string;
  invite_count?: string;
  notes_applicant?: string;
  agreement?: string | boolean;
  source_page?: string;
  company?: string; // honeypot
};

export async function POST(req: Request) {
  const origin  = req.headers.get("origin");
  const headers = corsHeaders(origin);

  let p: Payload;
  try {
    p = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400, headers });
  }

  // Honeypot — pretend success, drop silently.
  if (p.company && p.company.trim().length > 0) {
    return NextResponse.json({ ok: true }, { headers });
  }

  const fullName = (p.full_name ?? "").trim();
  const email    = (p.email ?? "").trim().toLowerCase();

  if (!fullName || fullName.length > 200) {
    return NextResponse.json({ ok: false, error: "Please enter your name." }, { status: 400, headers });
  }
  if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email." }, { status: 400, headers });
  }

  // Payload size guard — legitimate applications are small.
  const totalLen = JSON.stringify(p).length;
  if (totalLen > 16000) {
    return NextResponse.json({ ok: false, error: "Request too large." }, { status: 413, headers });
  }

  const trim = (v?: string | boolean) =>
    typeof v === "string" ? v.trim().slice(0, 4000) : null;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, detectSessionInUrl: false },
  });

  const { error } = await supabase.from("ambassador_applications").insert({
    full_name:       fullName.slice(0, 200),
    email,
    country:         trim(p.country),
    horses:          trim(p.horses),
    discipline:      trim(p.discipline),
    describes:       trim(p.describes),
    instagram:       trim(p.instagram),
    tiktok:          trim(p.tiktok),
    facebook:        trim(p.facebook),
    youtube:         trim(p.youtube),
    other_links:     trim(p.other_links),
    audience:        trim(p.audience),
    community_type:  trim(p.community_type),
    community_size:  trim(p.community_size),
    support:         trim(p.support),
    invite_count:    trim(p.invite_count),
    notes_applicant: trim(p.notes_applicant),
    agreement:       p.agreement === true || p.agreement === "agreed" || p.agreement === "true",
    source_page:     trim(p.source_page),
    ip,
    user_agent:      ua,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Could not submit your application. Please try again." },
      { status: 500, headers },
    );
  }

  return NextResponse.json({ ok: true }, { headers });
}
