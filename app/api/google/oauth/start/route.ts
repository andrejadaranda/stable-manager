// Begin Google OAuth. Requires a logged-in Longrein session; sets a CSRF
// state cookie and redirects to Google's consent screen. The callback ties
// the returned tokens to whichever Longrein user completes the flow.
//
// IMPORTANT: the state cookie MUST be set on a NextResponse. A cookie set via
// cookies().set() is NOT attached to a bare `Response.redirect`, which would
// make the callback reject the round-trip ("something went wrong").

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { buildAuthUrl } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
    await getSession(); // must be authenticated
  } catch {
    return NextResponse.redirect(new URL("/login", req.url), 302);
  }
  const state = crypto.randomUUID();
  const origin = new URL(req.url).origin;
  const res = NextResponse.redirect(buildAuthUrl(state, origin), 302);
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
