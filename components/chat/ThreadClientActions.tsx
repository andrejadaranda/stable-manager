"use client";

// Per-person action bar shown at the top of a client's chat thread (owner/
// employee only). Turns the conversation into the hub: send an invoice into
// the chat, send the person a reminder, and jump to their pending requests.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ThreadClientContext } from "@/services/conversationContext";
import {
  sendInvoiceFromChatAction,
  sendReminderFromChatAction,
  type ChatActionState,
} from "@/app/dashboard/chat/context-actions";

export function ThreadClientActions({ ctx }: { ctx: ThreadClientContext }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<ChatActionState | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderText, setReminderText] = useState("");

  const pendingTotal = ctx.pendingLessonCount + ctx.pendingCareCount;

  function sendInvoice() {
    setFlash(null);
    startTransition(async () => {
      const res = await sendInvoiceFromChatAction(ctx.clientId);
      setFlash(res);
      if (res.ok) router.refresh(); // surface the posted invoice message
    });
  }

  function sendReminder() {
    const text = reminderText.trim();
    if (!text) return;
    setFlash(null);
    startTransition(async () => {
      const res = await sendReminderFromChatAction(ctx.clientProfileId, text);
      setFlash(res);
      if (res.ok) {
        setReminderText("");
        setReminderOpen(false);
      }
    });
  }

  return (
    <div className="px-4 md:px-6 py-2.5 border-b border-ink-100 bg-ink-50/40 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sendInvoice}
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

        {pendingTotal > 0 && (
          <Link
            href="/dashboard/inbox"
            className="h-8 px-3 rounded-lg text-[13px] font-medium text-amber-800 ring-1 ring-amber-300 bg-amber-50 hover:bg-amber-100 inline-flex items-center gap-1.5 transition-colors ml-auto"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {pendingTotal} pending {pendingTotal === 1 ? "request" : "requests"} · Review
          </Link>
        )}
      </div>

      {reminderOpen && (
        <div className="flex items-end gap-2">
          <textarea
            value={reminderText}
            onChange={(e) => setReminderText(e.target.value)}
            rows={1}
            maxLength={500}
            placeholder={`Remind ${ctx.clientName.split(" ")[0]}…`}
            className="flex-1 resize-none rounded-lg border border-ink-200 bg-white text-[13px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
          />
          <button
            type="button"
            onClick={sendReminder}
            disabled={pending || !reminderText.trim()}
            className="h-9 px-3 rounded-lg text-[13px] font-medium bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50"
          >
            Send
          </button>
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
