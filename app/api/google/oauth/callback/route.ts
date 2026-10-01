// Google OAuth callback. Verifies the CSRF state, exchanges the code for
// tokens, stores them (service-role), pulls the calendar list, and bounces
// back to the integrations settings page. Errors surface as a query flag so
// the UI can show a friendly message instead of a raw stack.

import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { exchangeCode, fetchUserEmail } from "@/lib/google/oauth";
import { saveConnectionFromTokens, syncCalendarList } from "@/services/googleCalendar";

export const dynamic = "force-dynamic";

const SETTINGS = "/dashboard/settings/integrations";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieState = cookies().get("g_oauth_state")?.value;
  cookies().delete("g_oauth_state");

  if (error) return redirect(origin, `${SETTINGS}?google=denied`);
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirect(origin, `${SETTINGS}?google=error`);
  }

  let session;
  try {
    session = await getSession();
  } catch {
    return redirect(origin, "/login");
  }

  try {
    const tokens = await exchangeCode(code, origin);
    const email = await fetchUserEmail(tokens.access_token);
    await saveConnectionFromTokens(session.userId, session.stableId, tokens, email);
    // Populate the calendar list so the user can pick which to read/write.
    await syncCalendarList(session.userId).catch(() => {});
    return redirect(origin, `${SETTINGS}?google=connected`);
  } catch {
    return redirect(origin, `${SETTINGS}?google=error`);
  }
}

function redirect(origin: string, path: string): Response {
  return Response.redirect(new URL(path, origin), 302);
}
