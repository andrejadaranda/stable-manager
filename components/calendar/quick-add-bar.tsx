"use client";

// Quick add — the TimeTree-simple capture Andrėja actually wants.
//
// One text box. She types a one-liner like "Justė 16h" or "grupė 17:30"
// and hits Save. That's it — a lesson appears at that time. No required
// client picker, no price, no horse. The typed text becomes the client
// name (matched to an existing client when it lines up), the time is
// parsed out, and everything else is filled in later by tapping the
// lesson. This is the primary way to book; the full "New lesson" form
// stays available for when she wants every field.
//
// Reuses createLessonAction (new_client_name auto-creates/looks-up the
// client) + the LT-aware parseIntake — no new server code, no migration.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLessonAction } from "@/app/dashboard/calendar/actions";
import { parseIntake } from "@/lib/intake/parse";

type ClientOpt = { id: string; full_name: string };

const DURATION_MIN = 45;

export function QuickAddBar({
  clients,
  trainerId,
  arenaId,
  dayKey,
}: {
  clients: ClientOpt[];
  /** Sole trainer's id when the stable has exactly one, else "". */
  trainerId: string;
  /** Default arena id (first active), or "". */
  arenaId: string;
  /** Currently focused day (YYYY-MM-DD) — used when the text has no date. */
  dayKey: string;
}) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function save() {
    const raw = text.trim();
    if (!raw) return;
    setMsg(null);

    const d = parseIntake(raw, new Date());
    // Name = what the parser pulled, else the whole line (so nothing is lost).
    const name = (d.name ?? raw).trim();

    // Link to an existing client when the name matches exactly (case-insensitive);
    // otherwise let the server create one from new_client_name.
    const existing = clients.find(
      (c) => c.full_name.trim().toLowerCase() === name.toLowerCase(),
    );

    // Date: parsed, else the focused day. Time: parsed, else a sensible default.
    const date = d.date ?? dayKey;
    const time = d.time ?? defaultTime(dayKey);
    const start = buildLocal(date, time);
    if (!start) { setMsg("Neatpažinau laiko — bandyk pvz. „Justė 16h\"."); return; }
    const end = new Date(start.getTime() + DURATION_MIN * 60_000);

    const fd = new FormData();
    if (existing) fd.set("client_id", existing.id);
    else fd.set("new_client_name", name);
    fd.set("starts_at", start.toISOString());
    fd.set("ends_at", end.toISOString());
    if (trainerId) fd.set("trainer_id", trainerId);
    if (arenaId) fd.set("arena_id", arenaId);
    // Keep the original line as notes so the full context is never lost.
    fd.set("notes", raw);

    startTransition(async () => {
      const r = await createLessonAction({ error: null, success: false }, fd);
      if (r.error) { setMsg(r.error); return; }
      setText("");
      setMsg(`Įrašyta ✓ ${labelFor(name, time)}`);
      inputRef.current?.focus();
      router.refresh();
      setTimeout(() => setMsg(null), 2500);
    });
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span aria-hidden className="pl-1 text-lg leading-none">⚡</span>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
          placeholder='pvz.: „Justė 16h" arba „Emilija rytoj 15:30"'
          aria-label="Quick add lesson"
          className="flex-1 min-w-0 h-11 rounded-xl border border-ink-200 bg-white text-[16px] text-ink-900 placeholder:text-ink-400 px-3 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending || !text.trim()}
          className="h-11 px-4 shrink-0 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "…" : "Save"}
        </button>
      </div>
      {msg && <p className="text-[11.5px] text-ink-600 pl-1 leading-snug">{msg}</p>}
    </div>
  );
}

// Default start time for a day with no time in the text: next 15-min mark if
// the day is today, else 09:00.
function defaultTime(dayKey: string): string {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (dayKey !== todayKey) return "09:00";
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildLocal(dateStr: string, timeStr: string): Date | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function labelFor(name: string, time: string): string {
  const short = name.length > 24 ? name.slice(0, 24) + "…" : name;
  return `${short} · ${time}`;
}

function pad(n: number): string { return String(n).padStart(2, "0"); }
