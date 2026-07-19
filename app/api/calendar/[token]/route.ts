// Public per-user iCalendar (.ics) feed.
//
// GET /api/calendar/<calendar_token>  → text/calendar
//
// The token IS the credential (a random uuid on the profile). Anyone with the
// URL can read that trainer's lesson calendar — this is exactly how Google /
// Apple / Outlook calendar subscriptions work. Subscribe to the webcal URL in
// Google Calendar or Apple Calendar and your Longrein lessons appear there
// (and, because TimeTree displays your Google/iCloud calendar, in TimeTree too).
//
// Uses the service-role client because the request is unauthenticated — access
// is scoped entirely by the secret token → one profile → that stable's lessons
// for that trainer.

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LessonRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  lesson_type: string | null;
  horse:   { name: string } | null;
  client:  { full_name: string } | null;
  arena:   { name: string } | null;
  service: { name: string } | null;
};

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = params.token?.replace(/\.ics$/i, "");
  if (!token || !UUID_RE.test(token)) {
    return new Response("Not found", { status: 404 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, stable_id, full_name")
    .eq("calendar_token", token)
    .maybeSingle();
  const p = profile as { id: string; stable_id: string; full_name: string | null } | null;
  if (!p) return new Response("Not found", { status: 404 });

  // Window: last 60 days → next 365 days keeps the feed light but complete.
  const from = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const to   = new Date(Date.now() + 365 * 86_400_000).toISOString();

  const { data: lessons } = await supabase
    .from("lessons")
    .select(`
      id, starts_at, ends_at, status, lesson_type,
      horse:horses!lessons_horse_id_fkey(name),
      client:clients!lessons_client_id_fkey(full_name),
      arena:arenas(name),
      service:services(name)
    `)
    .eq("stable_id", p.stable_id)
    .eq("trainer_id", p.id)
    .neq("status", "cancelled")
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at", { ascending: true });

  const rows = (lessons ?? []) as unknown as LessonRow[];
  const now = icalDate(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Longrein//Lessons//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Longrein${p.full_name ? ` — ${p.full_name}` : ""}`,
    "X-WR-TIMEZONE:Europe/Vilnius",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];

  for (const l of rows) {
    const isGroup = l.lesson_type === "group";
    const title = isGroup
      ? (l.service?.name ? `Group · ${l.service.name}` : "Group lesson")
      : [l.horse?.name, l.client?.full_name].filter(Boolean).join(" · ") || "Lesson";
    const descBits = [
      l.service?.name ? `Service: ${l.service.name}` : null,
      l.status === "completed" ? "Completed" : null,
    ].filter(Boolean) as string[];

    lines.push(
      "BEGIN:VEVENT",
      `UID:lesson-${l.id}@longrein.eu`,
      `DTSTAMP:${now}`,
      `DTSTART:${icalDate(new Date(l.starts_at))}`,
      `DTEND:${icalDate(new Date(l.ends_at))}`,
      foldLine(`SUMMARY:${esc(title)}`),
      l.arena?.name ? foldLine(`LOCATION:${esc(l.arena.name)}`) : "",
      descBits.length ? foldLine(`DESCRIPTION:${esc(descBits.join(" · "))}`) : "",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  const body = lines.filter(Boolean).join("\r\n") + "\r\n";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="longrein.ics"',
      "Cache-Control": "public, max-age=900",
    },
  });
}

/** Date → iCal UTC basic format: 20260710T113600Z */
function icalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escape text per RFC 5545 (backslash, comma, semicolon, newline). */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold long content lines at 74 octets with CRLF + space (RFC 5545). */
function foldLine(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 73) {
    parts.push(" " + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}
