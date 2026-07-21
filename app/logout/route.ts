// Easy escape hatch: GET /logout signs the current user out and returns to the
// login screen. Handy when you land in the wrong account (e.g. the demo) and
// the sidebar sign-out is hard to reach on mobile — just open /logout.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();
  try {
    await supabase.auth.signOut();
  } catch {
    /* already signed out — fall through to login */
  }
  return NextResponse.redirect(new URL("/login", req.url));
}
