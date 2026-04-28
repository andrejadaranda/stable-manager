"use client";

// Message list + input for one thread, with Supabase Realtime
// subscription on chat_messages filtered by thread_id.
//
// Realtime details:
//   * Realtime publication includes chat_messages (migration 09).
//   * RLS chat_messages_read enforces per-row authorization at
//     delivery time, so cross-stable / non-participant rows never
//     reach the client.
//   * The browser uses the anon JWT cookie via createSupabaseBrowserClient.
//     No service role on the client.
//
// Sender display: realtime payloads have raw rows (no joined sender).
// We keep an in-memory cache (id -> name) populated from initial
// messages. When a new sender appears, router.refresh() triggers
// the server component to re-fetch with fresh joins.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ChatMessageRow } from "@/services/chat";
import { sendMessageAction } from "@/app/dashboard/chat/actions";
import { Button } from "@/components/ui";

type RealtimeRow = {
  id: string;
  stable_id: string;
  thread_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export function MessagePanel({
  threadId,
  initialMessages,
  sessionUserId,
}: {
  threadId: string;
  initialMessages: ChatMessageRow[];
  sessionUserId: string;
}) {
  const router = useRouter();
  // Keep messages oldest-first for rendering. Service returns desc, reverse here.
  const [messages, setMessages] = useState<ChatMessageRow[]>(
    () => [...initialMessages].reverse(),
  );
  // Reset whenever initial set or thread changes (parent re-keys, but defensive).
  useEffect(() => {
    setMessages([...initialMessages].reverse());
  }, [initialMessages]);

  // Build sender cache from initial data.
  const senderCacheRef = useRef<Map<string, ChatMessageRow["sender"]>>(new Map());
  useEffect(() => {
    const m = senderCacheRef.current;
    for (const msg of initialMessages) {
      if (msg.sender) m.set(msg.sender_profile_id, msg.sender);
    }
  }, [initialMessages]);

  // Track ids we've already seen so realtime + optimistic don't dupe.
  const seenIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    seenIdsRef.current = new Set(messages.map((m) => m.id));
  }, [messages]);

  // ---- Realtime subscription ----------------------------------
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`chat:thread:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as RealtimeRow;
          if (!row || row.thread_id !== threadId) return;
          if (seenIdsRef.current.has(row.id)) return;

          const cachedSender = senderCacheRef.current.get(row.sender_profile_id) ?? null;
          const incoming: ChatMessageRow = {
            id: row.id,
            stable_id: row.stable_id,
            thread_id: row.thread_id,
            sender_profile_id: row.sender_profile_id,
            body: row.body,
            created_at: row.created_at,
            edited_at: row.edited_at,
            sender: cachedSender,
          };
          setMessages((prev) => [...prev, incoming]);

          // If sender unknown to cache, refresh server data so we can
          // render the proper name. router.refresh() re-runs the
          // server component without losing client state.
          if (!cachedSender && row.sender_profile_id !== sessionUserId) {
            router.refresh();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, router, sessionUserId]);

  // Auto-scroll to bottom on new messages.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <>
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-sm text-ink-500">
            Dar nėra žinučių. Parašyk pirmą.
          </div>
        )}
        <ul className="flex flex-col gap-3">
          {messages.map((m) => {
            const mine = m.sender_profile_id === sessionUserId;
            return (
              <li
                key={m.id}
                className={`flex flex-col max-w-[80%] ${mine ? "self-end items-end" : "self-start items-start"}`}
              >
                <div
                  className={`
                    px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words
                    ${mine
                      ? "bg-brand-600 text-white rounded-br-md"
                      : "bg-ink-100/80 text-ink-900 rounded-bl-md"
                    }
                  `}
                >
                  {m.body}
                </div>
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400 mt-1 px-1">
                  {!mine && (m.sender?.full_name ?? "Narys")}
                  {!mine && " · "}
                  {formatTime(m.created_at)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <MessageInput threadId={threadId} onOptimistic={(opt) => {
        seenIdsRef.current.add(opt.id);
        setMessages((prev) => [...prev, opt]);
      }} sessionUserId={sessionUserId} />
    </>
  );
}

// ---------- Input ----------------------------------------------

function MessageInput({
  threadId,
  onOptimistic,
  sessionUserId,
}: {
  threadId: string;
  onOptimistic: (m: ChatMessageRow) => void;
  sessionUserId: string;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const text = value.trim();
    if (!text) return;
    setError(null);

    // Optimistic message — replaced when server roundtrip returns.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: ChatMessageRow = {
      id: tempId,
      stable_id: "",
      thread_id: threadId,
      sender_profile_id: sessionUserId,
      body: text,
      created_at: new Date().toISOString(),
      edited_at: null,
      sender: null,
    };
    onOptimistic(optimistic);
    setValue("");

    startTransition(async () => {
      const res = await sendMessageAction(threadId, text);
      if (!res.ok) {
        setError(res.error);
        // Restore the input so user can retry.
        setValue(text);
        // We don't currently roll back the optimistic message; the
        // user sees their failed text reappear in the box and can resend.
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-ink-100 px-4 md:px-6 py-3">
      {error && (
        <p className="text-xs text-rose-600 mb-2">{error}</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Parašyk žinutę…  (Enter = siųsti, Shift+Enter = nauja eilutė)"
          maxLength={4000}
          className="
            flex-1 resize-none rounded-xl border border-ink-200
            bg-white text-sm text-ink-900 placeholder:text-ink-400
            px-3 py-2.5 max-h-40 leading-relaxed
            focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600
          "
        />
        <Button
          type="button"
          onClick={submit}
          loading={isPending}
          disabled={!value.trim()}
        >
          Siųsti
        </Button>
      </div>
    </div>
  );
}

// ---------- formatting ----------------------------------------

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
