// GET /r/:code — ambassador referral link.
//
// Drops an `lr_ref` cookie carrying the ambassador's referral code, then
// redirects the visitor into owner signup. The checkout route reads the
// cookie and tags the Stripe subscription so the webhook can credit the
// ambassador on the first PAID invoice. Purely additive — no cookie means
// the rest of the funnel behaves exactly as before.

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const CODE_RE = /^[A-Z0-9-]{4,40}$/i;
const SIGNUP_PATH = "/signup/owner";
const COOKIE = "lr_ref";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function GET(req: NextRequest, ctx: { params: { code: string } }) {
  const code = (ctx.params.code ?? "").trim();
  const url = req.nextUrl.clone();
  url.pathname = SIGNUP_PATH;
  url.search = "";

  const res = NextResponse.redirect(url);
  if (CODE_RE.test(code)) {
    res.cookies.set(COOKIE, code.toUpperCase(), {
      path: "/",
      maxAge: MAX_AGE,
      sameSite: "lax",
      httpOnly: false, // not sensitive; just a referral attribution tag
      secure: true,
    });
  }
  return res;
}
