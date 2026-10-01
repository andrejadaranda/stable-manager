// Begin Google OAuth. Requires a logged-in Longrein session; sets a CSRF
// state cookie and redirects to Google's consent screen. The callback ties
// the returned tokens to whichever Longrein user completes the flow.

import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { buildAuthUrl } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  try {
    await getSession(); // must be authenticated
  } catch {
    return Response.redirect(new URL("/login", req.url), 302);
  }
  const state = crypto.randomUUID();
  cookies().set("g_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  const origin = new URL(req.url).origin;
  return Response.redirect(buildAuthUrl(state, origin), 302);
}
