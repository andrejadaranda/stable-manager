"use client";

// Per-person hub bar at the top of a client's chat thread (owner/employee).
// The conversation is the hub: send an invoice into the chat, send the person
// a reminder, and act on their pending requests as inline cards.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ThreadClientContext } from "@/services/conversationContext";
import {
  sendInvoiceFromChatAction,
  sendCustomInvoiceFromChatAction,
  sendReminderFromChatAction,
  completeReminderFromChatAction,
  deleteReminderFromChatAction,
  acknowledgeCareRequestAction,
  declineCareRequestAction,
  declineLessonRequestAction,
  type ChatActionState,
} from "@/app/dashboard/chat/context-actions";

const REMINDER_PRESETS: Array<{ label: string; text: string }> = [
  { label: "Debt", text: "Reminder: you have an outstanding balance to settle." },
  { label: "Lesson", text: "Reminder about your upcoming lesson." },
  { label: "Documents", text: "Reminder: please send the missing documents." },
];

export function ThreadClientActions({ ctx }: { ctx: ThreadClientContext }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<ChatActionState | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderText, setReminderText] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [customDesc, setCustomDesc] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  const requestCount = ctx.lessonRequests.length + ctx.careRequests.length;

  function run(fn: () => Promise<ChatActionState>, refreshOnOk = true) {
    setFlash(null);
    startTransition(async () => {
      const res = await fn();
      setFlash(res);
      if (res.ok && refreshOnOk) router.refresh();
    });
  }

  function sendReminder() {
    const text = reminderText.trim();
    if (!text) return;
    run(async () => {
      const res = await sendReminderFromChatAction(ctx.clientProfileId, text);
      if (res.ok) { setReminderText(""); setReminderOpen(false); }
      return res;
    });
  }

  function sendCustomInvoice() {
    const amt = Number(customAmount);
    if (!customDesc.trim() || !Number.isFinite(amt) || amt <= 0) return;
    run(async () => {
      const res = await sendCustomInvoiceFromChatAction(ctx.clientId, customDesc.trim(), amt);
      if (res.ok) { setCustomDesc(""); setCustomAmount(""); setInvoiceOpen(false); }
      return res;
    });
  }

  return (
    <div className="px-4 md:px-6 py-2.5 border-b border-ink-100 bg-ink-50/40 flex flex-col gap-2.5">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { setInvoiceOpen((v) => !v); setReminderOpen(false); setFlash(null); }}
          disabled={pending}
          className="h-8 px-3 rounded-lg text-[13px] font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          Send invoice
        </button>
        <button
          type="button"
          onClick={() => { setReminderOpen((v) => !v); setFlash(null); }}
          disabled={pending}
          className="h-8 px-3 rounded-lg text-[13px] font-medium text-ink-800 ring-1 ring-ink-200 bg-white hover:bg-ink-50 disabled:opacity-50 transition-colors"
        >
          Send reminder
        </button>
        {requestCount > 0 && (
          <span className="ml-auto text-[12px] text-ink-500">
            {requestCount} pending {requestCount === 1 ? "request" : "requests"}
          </span>
        )}
      </div>

      {invoiceOpen && (
        <div className="flex flex-col gap-2 rounded-lg bg-ink-50/40 p-2.5">
          <button
            type="button"
            onClick={() => run(() => sendInvoiceFromChatAction(ctx.clientId))}
            disabled={pending}
            className="h-8 self-start px-3 rounded-lg text-[13px] font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            From unpaid items
          </button>
          <div className="flex items-end gap-2">
            <input
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              placeholder="Custom service (e.g. Extra lesson)"
              maxLength={120}
              className="flex-1 min-w-0 rounded-lg border border-ink-200 bg-white text-[16px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
            />
            <input
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              type="number" min="0" step="0.01"
              placeholder="€"
              className="w-20 shrink-0 rounded-lg border border-ink-200 bg-white text-[16px] px-2 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
            />
            <button
              type="button"
              onClick={sendCustomInvoice}
              disabled={pending || !customDesc.trim() || !customAmount}
              className="h-9 px-3 rounded-lg text-[13px] font-medium bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <p className="text-[11px] text-ink-500">
            "From unpaid items" bills everything outstanding. Or type a one-off service + price.
          </p>
        </div>
      )}

      {reminderOpen && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setReminderText(p.text)}
                className="h-7 px-2.5 rounded-md text-[11px] font-medium text-ink-700 ring-1 ring-ink-200 bg-white hover:bg-ink-50 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={reminderText}
              onChange={(e) => setReminderText(e.target.value)}
              rows={1}
              maxLength={500}
              placeholder={`Remind ${ctx.clientName.split(" ")[0]}… (or pick a preset)`}
              className="flex-1 resize-none rounded-lg border border-ink-200 bg-white text-[16px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
            />
            <button
              type="button"
              onClick={sendReminder}
              disabled={pending || !reminderText.trim()}
              className="h-9 px-3 rounded-lg text-[13px] font-medium bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Pending request cards */}
      {(ctx.lessonRequests.length > 0 || ctx.careRequests.length > 0) && (
        <div className="flex flex-col gap-1.5">
          {ctx.lessonRequests.map((r) => (
            <RequestCard
              key={r.id}
              tone="brand"
              title="Lesson request"
              meta={[r.whenLabel, r.horse].filter(Boolean).join(" · ") || "No time proposed"}
              note={r.note}
            >
              <Link
                href="/dashboard/inbox"
                className="h-7 px-2.5 rounded-md text-[12px] font-medium bg-brand-600 text-white hover:bg-brand-700 inline-flex items-center"
              >
                Schedule
              </Link>
              <CardBtn
                label="Decline"
                onClick={() => run(() => declineLessonRequestAction(r.id))}
                disabled={pending}
                danger
              />
            </RequestCard>
          ))}
          {ctx.careRequests.map((r) => (
            <RequestCard
              key={r.id}
              tone={r.urgency === "high" ? "rose" : "ink"}
              title={`${cap(r.kind)} request`}
              meta={[r.urgency !== "normal" ? `${r.urgency} urgency` : null, r.horse].filter(Boolean).join(" · ") || null}
              note={r.note}
            >
              <CardBtn
                label="Acknowledge"
                onClick={() => run(() => acknowledgeCareRequestAction(r.id))}
                disabled={pending}
              />
              <CardBtn
                label="Decline"
                onClick={() => run(() => declineCareRequestAction(r.id))}
                disabled={pending}
                danger
              />
            </RequestCard>
          ))}
        </div>
      )}

      {/* Interactive reminders — mark complete or remove, right here */}
      {ctx.reminders.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {ctx.reminders.map((r) => (
            <div key={r.id} className="rounded-lg bg-white ring-1 ring-ink-200 px-3 py-2 flex items-center gap-2.5">
              <span className="shrink-0 text-[13px]" aria-hidden>🔔</span>
              <p className="min-w-0 flex-1 text-[13px] text-ink-900 truncate">{r.body}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => run(() => completeReminderFromChatAction(r.id))}
                  disabled={pending}
                  className="h-7 px-2.5 rounded-md text-[12px] font-medium text-emerald-800 ring-1 ring-emerald-200 bg-white hover:bg-emerald-50 disabled:opacity-50"
                >
                  Complete
                </button>
                <button
                  type="button"
                  onClick={() => run(() => deleteReminderFromChatAction(r.id))}
                  disabled={pending}
                  className="text-ink-400 hover:text-rose-600 px-1"
                  aria-label="Remove reminder"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {flash && (
        <p className={`text-[12px] ${flash.ok ? "text-emerald-700" : "text-rose-600"}`}>
          {flash.message}
        </p>
      )}
    </div>
  );
}

function RequestCard({
  tone,
  title,
  meta,
  note,
  children,
}: {
  tone: "brand" | "rose" | "ink";
  title: string;
  meta: string | null;
  note: string | null;
  children: React.ReactNode;
}) {
  const dot =
    tone === "brand" ? "bg-brand-500" : tone === "rose" ? "bg-rose-500" : "bg-ink-400";
  return (
    <div className="rounded-lg bg-white ring-1 ring-ink-200 px-3 py-2 flex items-center gap-3">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink-900 truncate">
          {title}
          {meta && <span className="font-normal text-ink-500"> · {meta}</span>}
        </p>
        {note && <p className="text-[12px] text-ink-500 truncate">{note}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </div>
  );
}

function CardBtn({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-7 px-2.5 rounded-md text-[12px] font-medium ring-1 disabled:opacity-50 transition-colors ${
        danger
          ? "text-rose-700 ring-rose-200 bg-white hover:bg-rose-50"
          : "text-ink-800 ring-ink-200 bg-white hover:bg-ink-50"
      }`}
    >
      {label}
    </button>
  );
}

function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
