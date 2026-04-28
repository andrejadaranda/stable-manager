"use client";

// Two-column chat shell. Conversation list on the left, message panel
// on the right. On mobile, the right panel slides over the list when
// a thread is selected; a back button returns to the list.
//
// Thread switching is URL-driven (?thread=ID) so refreshes preserve
// state and the server component re-fetches messages.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ChatMessageRow, ChatThreadRow } from "@/services/chat";
import type { Role } from "@/lib/auth/session";
import { MessagePanel } from "./MessagePanel";
import { NewDmButton } from "./NewDmDialog";
import { markReadAction } from "@/app/dashboard/chat/actions";

export function ChatLayout({
  threads,
  activeThreadId,
  initialMessages,
  sessionUserId,
  sessionRole,
}: {
  threads: ChatThreadRow[];
  activeThreadId: string | null;
  initialMessages: ChatMessageRow[];
  sessionUserId: string;
  sessionRole: Role;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId],
  );

  // Mobile: when a thread is selected, hide the conversation list
  // and show the message panel full-width. Back button returns.
  const [mobilePanel, setMobilePanel] = useState<"list" | "thread">(
    activeThreadId ? "thread" : "list",
  );
  useEffect(() => {
    setMobilePanel(activeThreadId ? "thread" : "list");
  }, [activeThreadId]);

  // Mark active thread as read whenever it changes.
  useEffect(() => {
    if (activeThreadId) {
      markReadAction(activeThreadId);
    }
  }, [activeThreadId]);

  function selectThread(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("thread", id);
    router.push(`/dashboard/chat?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="card-elevated flex-1 min-h-0 flex overflow-hidden">
      {/* LEFT — conversation list */}
      <aside
        className={`
          w-full md:w-80 md:shrink-0 md:border-r md:border-ink-100
          flex flex-col min-h-0
          ${mobilePanel === "list" ? "flex" : "hidden md:flex"}
        `}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
          <h2 className="text-sm font-semibold text-ink-900">Pokalbiai</h2>
          {sessionRole !== "client" || true ? (
            // Clients can also start DMs (with employees), so always show.
            <NewDmButton onCreated={(id) => selectThread(id)} />
          ) : null}
        </div>

        <ul className="flex-1 overflow-y-auto py-1">
          {threads.length === 0 && (
            <li className="px-4 py-6 text-sm text-ink-500">
              Pokalbių dar nėra.
            </li>
          )}
          {threads.map((t) => {
            const isActive = t.id === activeThreadId;
            const label = threadLabel(t, sessionUserId);
            const subtitle = threadSubtitle(t);
            const unread =
              t.last_read_at == null
                ? t.updated_at > t.created_at
                : t.updated_at > t.last_read_at;

            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => selectThread(t.id)}
                  className={`
                    w-full text-left px-4 py-3 flex items-start gap-3
                    transition-colors
                    ${isActive ? "bg-brand-50/70" : "hover:bg-ink-50/50"}
                  `}
                >
                  <ThreadAvatar thread={t} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm truncate ${
                          isActive ? "text-ink-900 font-semibold" : "text-ink-800 font-medium"
                        }`}
                      >
                        {label}
                      </span>
                      {unread && !isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" aria-label="naujos žinutės" />
                      )}
                    </div>
                    {subtitle && (
                      <p className="text-xs text-ink-500 mt-0.5 truncate">{subtitle}</p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* RIGHT — message panel */}
      <section
        className={`
          flex-1 min-w-0 flex flex-col min-h-0
          ${mobilePanel === "thread" ? "flex" : "hidden md:flex"}
        `}
      >
        {activeThread ? (
          <>
            <header className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-ink-100">
              <button
                type="button"
                onClick={() => setMobilePanel("list")}
                className="md:hidden p-1 -ml-1 rounded-lg text-ink-700 hover:bg-ink-100/60"
                aria-label="Atgal į pokalbių sąrašą"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <ThreadAvatar thread={activeThread} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">
                  {threadLabel(activeThread, sessionUserId)}
                </p>
                {threadSubtitle(activeThread) && (
                  <p className="text-xs text-ink-500 truncate">
                    {threadSubtitle(activeThread)}
                  </p>
                )}
              </div>
            </header>
            <MessagePanel
              key={activeThread.id}
              threadId={activeThread.id}
              initialMessages={initialMessages}
              sessionUserId={sessionUserId}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center px-6 py-12 text-center">
            <div>
              <p className="text-sm font-semibold text-ink-900">Pasirink pokalbį</p>
              <p className="text-sm text-ink-500 mt-1.5 max-w-xs mx-auto">
                Bendras stable'os kanalas yra viršuje. Naują tiesioginį
                pokalbį pradėk mygtuku „Naujas pokalbis".
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- helpers ----------

function threadLabel(t: ChatThreadRow, sessionUserId: string): string {
  if (t.type === "stable_general") return t.title || "Bendras kanalas";
  // direct: show the OTHER participant's name
  const other = t.participants.find((p) => p.id !== sessionUserId);
  if (other?.full_name) return other.full_name;
  return "Tiesioginis pokalbis";
}

function threadSubtitle(t: ChatThreadRow): string | null {
  if (t.type === "stable_general") return "Visi stable'os nariai";
  const roles = Array.from(new Set(t.participants.map((p) => p.role))).join(" · ");
  return roles || null;
}

function ThreadAvatar({ thread }: { thread: ChatThreadRow }) {
  if (thread.type === "stable_general") {
    return (
      <span className="w-9 h-9 shrink-0 rounded-full bg-brand-600 text-white inline-flex items-center justify-center text-xs font-semibold">
        #
      </span>
    );
  }
  const other = thread.participants[0];
  const initial = (other?.full_name ?? "?")[0]?.toUpperCase() ?? "?";
  return (
    <span className="w-9 h-9 shrink-0 rounded-full bg-ink-900 text-white inline-flex items-center justify-center text-xs font-semibold">
      {initial}
    </span>
  );
}
