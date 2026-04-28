"use client";

// Lightweight contact picker for starting a new direct chat. Opens
// inline as a popover; pulls the allowed-target list from the server
// via listContactsAction (which honors RLS + the chat_can_dm pair
// rules). On selection, calls startDirectChatAction and notifies the
// parent which thread to open.

import { useEffect, useRef, useState, useTransition } from "react";
import {
  listContactsAction,
  startDirectChatAction,
} from "@/app/dashboard/chat/actions";
import type { ChatContact } from "@/services/chat";

export function NewDmButton({ onCreated }: { onCreated: (threadId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ChatContact[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function openPanel() {
    setOpen((v) => !v);
    setError(null);
    if (contacts == null && !loading) {
      setLoading(true);
      try {
        const list = await listContactsAction();
        setContacts(list);
      } finally {
        setLoading(false);
      }
    }
  }

  function pick(c: ChatContact) {
    setError(null);
    startTransition(async () => {
      const res = await startDirectChatAction(c.profile_id);
      if (res.ok) {
        setOpen(false);
        onCreated(res.threadId);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={openPanel}
        aria-label="New conversation"
        className="
          h-8 w-8 inline-flex items-center justify-center rounded-lg
          text-ink-600 hover:bg-ink-100/60 hover:text-ink-900 transition-colors
        "
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div
          className="
            absolute right-0 top-10 z-30 w-72 max-h-80 overflow-hidden
            rounded-xl border border-ink-200 bg-white shadow-lift
            flex flex-col
          "
        >
          <div className="px-3 py-2.5 border-b border-ink-100">
            <p className="text-xs font-semibold text-ink-900">New conversation</p>
            <p className="text-[11px] text-ink-500 mt-0.5">Pick someone to message.</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <p className="px-3 py-4 text-xs text-ink-500">Loading…</p>
            )}
            {!loading && contacts && contacts.length === 0 && (
              <p className="px-3 py-4 text-xs text-ink-500">
                No contacts available. (Clients can only message trainers they've had lessons with.)
              </p>
            )}
            {!loading && contacts && contacts.length > 0 && (
              <ul className="py-1">
                {contacts.map((c) => (
                  <li key={c.profile_id}>
                    <button
                      type="button"
                      onClick={() => pick(c)}
                      disabled={isPending}
                      className="
                        w-full text-left px-3 py-2 flex items-center gap-2.5
                        hover:bg-ink-50/60 disabled:opacity-50
                      "
                    >
                      <span className="w-7 h-7 shrink-0 rounded-full bg-ink-900 text-white inline-flex items-center justify-center text-[11px] font-semibold">
                        {(c.full_name?.[0] ?? "?").toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink-900 truncate">
                          {c.full_name ?? "(no name)"}
                        </span>
                        <span className="block text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
                          {c.role}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className="px-3 py-2 text-xs text-rose-600 border-t border-ink-100">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
