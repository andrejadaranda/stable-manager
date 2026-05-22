// POST /api/feedback/submit
//
// One-click "Report a problem" handler for the in-app feedback widget.
// Founding 15 launch insurance — any user (logged in or not) can flag an
// issue and it lands in the founder's inbox within seconds, no triage
// tool required.
//
// Body shape:
//   { message: string                  // required, 1-4000 chars
//   , page?: string                    // current URL when reported
//   , user_agent?: string              // browser context
//   , reporter_email_override?: string // when the reporter is logged out
//   }
//
// We pull the logged-in user's email + stable from the Supabase session
// when present, so the email always identifies who reported what — even
// if they don't type their address themselves.
//
// Returns { ok: true } on success. Errors are 4xx for client problems,
// 500 for server problems; never echoes secrets back to the client.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TO_EMAIL = process.env.FEEDBACK_TO_EMAIL ?? "hello@longrein.eu";

export async function POST(req: Request) {
  let body: {
    message?: string;
    page?: string;
    user_agent?: string;
    reporter_email_override?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "Please describe what went wrong." },
      { status: 400 },
    );
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "Message is too long. Keep it under 4000 characters." },
      { status: 413 },
    );
  }

  // Resolve the reporter — prefer the session user, fall back to whatever
  // the client typed (for logged-out reports from /login etc.).
  let reporterEmail: string | null = null;
  let stableName:    string | null = null;
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      reporterEmail = user.email;
      // Best-effort stable lookup via profiles — non-fatal if missing.
      const { data: profile } = await supabase
        .from("profiles")
        .select("stable_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (profile?.stable_id) {
        const { data: stable } = await supabase
          .from("stables")
          .select("name")
          .eq("id", profile.stable_id)
          .maybeSingle();
        stableName = stable?.name ?? null;
      }
    }
  } catch (err) {
    console.warn("[feedback] session lookup failed:", err);
  }

  // If the session didn't resolve and the form provided an override, use it.
  if (!reporterEmail && body.reporter_email_override) {
    const override = body.reporter_email_override.trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(override) && override.length <= 254) {
      reporterEmail = override;
    }
  }

  const page      = (body.page ?? req.headers.get("referer") ?? "(unknown)").slice(0, 500);
  const userAgent = (body.user_agent ?? req.headers.get("user-agent") ?? "(unknown)").slice(0, 500);
  const reportedAt = new Date().toISOString();

  const subject = stableName
    ? `[Longrein feedback] ${stableName} — ${message.slice(0, 60)}`
    : `[Longrein feedback] ${message.slice(0, 60)}`;

  const escape = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

  const html = `<!doctype html><html><body style="font-family:-apple-system,sans-serif;background:#F4ECDF;padding:32px;color:#1B1B1B;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;padding:28px;">
  <p style="font-family:Georgia,serif;font-size:20px;color:#1E3A2A;margin:0 0 8px;">Longrein<span style="color:#B5793E;">.</span> feedback</p>
  <h1 style="font-family:Georgia,serif;font-size:22px;color:#1E3A2A;margin:0 0 20px;">${escape(stableName ?? "Anonymous report")}</h1>
  <div style="background:#F8F4EE;border-left:3px solid #B5793E;padding:14px 18px;border-radius:6px;margin:0 0 18px;white-space:pre-wrap;font-size:15px;line-height:1.55;">${escape(message)}</div>
  <table style="width:100%;font-size:13px;color:#6E6760;border-collapse:collapse;">
    <tr><td style="padding:6px 0;width:120px;">Reporter</td><td style="padding:6px 0;color:#1B1B1B;">${escape(reporterEmail ?? "(no email)")}</td></tr>
    <tr><td style="padding:6px 0;">Page</td><td style="padding:6px 0;color:#1B1B1B;"><a href="${escape(page)}" style="color:#1E3A2A;">${escape(page)}</a></td></tr>
    <tr><td style="padding:6px 0;">User agent</td><td style="padding:6px 0;color:#1B1B1B;font-size:12px;">${escape(userAgent)}</td></tr>
    <tr><td style="padding:6px 0;">Reported at</td><td style="padding:6px 0;color:#1B1B1B;">${escape(reportedAt)}</td></tr>
  </table>
</div>
</body></html>`;

  const text = [
    "Longrein feedback",
    "",
    `Stable: ${stableName ?? "(unknown)"}`,
    `Reporter: ${reporterEmail ?? "(no email)"}`,
    `Page: ${page}`,
    `User agent: ${userAgent}`,
    `Reported at: ${reportedAt}`,
    "",
    "--- Message ---",
    message,
  ].join("\n");

  try {
    await sendEmail({
      to:       TO_EMAIL,
      subject,
      html,
      text,
      // If reporter is known, route replies to them.
      replyTo:  reporterEmail ?? undefined,
    });
  } catch (err) {
    console.error("[feedback] send failed:", err);
    return NextResponse.json(
      { ok: false, error: "Couldn't deliver your report. Try again or email hello@longrein.eu directly." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
