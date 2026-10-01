// Google OAuth callback. Verifies the CSRF state, exchanges the code for
// tokens, stores them (service-role), pulls the calendar list, and bounces
// back to the integrations settings page. Errors surface as a query flag so
// the UI can show a friendly message instead of a raw stack — and are logged
// server-side so we can diagnose failures.

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { exchangeCode, fetchUserEmail } from "@/lib/google/oauth";
import { saveConnectionFromTokens, syncCalendarList } from "@/services/googleCalendar";

export const dynamic = "force-dynamic";

const SETTINGS = "/dashboard/settings/integrations";

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieState = req.cookies.get("g_oauth_state")?.value;

  const bounce = (path: string) => {
    const res = NextResponse.redirect(new URL(path, origin), 302);
    res.cookies.delete("g_oauth_state");
    return res;
  };

  if (error) {
    console.error("[google/callback] consent error:", error);
    return bounce(`${SETTINGS}?google=denied`);
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    console.error("[google/callback] state check failed", { hasCode: !!code, hasState: !!state, hasCookie: !!cookieState, match: state === cookieState });
    return bounce(`${SETTINGS}?google=error`);
  }

  let session;
  try {
    session = await getSession();
  } catch {
    return bounce("/login");
  }

  try {
    const tokens = await exchangeCode(code, origin);
    const email = await fetchUserEmail(tokens.access_token);
    await saveConnectionFromTokens(session.userId, session.stableId, tokens, email);
    await syncCalendarList(session.userId).catch((e) => console.error("[google/callback] calendar list sync failed:", e));
    return bounce(`${SETTINGS}?google=connected`);
  } catch (e) {
    console.error("[google/callback] token exchange / save failed:", e);
    return bounce(`${SETTINGS}?google=error`);
  }
}
