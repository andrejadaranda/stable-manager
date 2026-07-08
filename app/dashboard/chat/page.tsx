// /dashboard/chat — server entry. Fetches the conversation list and
// (if a thread is selected) its message history, then hands off to
// the client-side ChatLayout for interactivity + realtime.
//
// Visibility for every fetch is enforced by RLS via the service layer.

import { requirePageRole } from "@/lib/auth/redirects";
import { listChatThreads, getChatMessages } from "@/services/chat";
import { getThreadClientContext } from "@/services/conversationContext";
import { getStableFeatures } from "@/services/features";
import { PageHeader, FeatureDisabled } from "@/components/ui";
import { ChatLayout } from "@/components/chat/ChatLayout";

type SearchParams = { thread?: string };

export const dynamic = "force-dynamic";   // chat is always live; no static cache

export default async function ChatPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requirePageRole("owner", "employee", "client");

  const features = await getStableFeatures();
  if (!features.chat) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Messages" />
        <FeatureDisabled feature="Chat" isOwner={session.role === "owner"} />
      </div>
    );
  }

  const threads = await listChatThreads();

  // Pick the active thread: ?thread=ID if valid, else the first
  // visible thread (general is pinned at index 0). Falls back to
  // null when the user has no threads at all.
  const requested = searchParams.thread ?? null;
  const activeThread =
    (requested && threads.find((t) => t.id === requested)) ||
    threads[0] ||
    null;

  const initialMessages = activeThread
    ? await getChatMessages(activeThread.id, { limit: 100 })
    : [];

  // For a direct thread, resolve the other participant → client context so
  // the conversation doubles as the per-person hub (invoice / reminder /
  // pending requests). Null for the stable channel or non-client threads.
  const otherProfileId =
    activeThread && activeThread.type === "direct"
      ? activeThread.participants.find((p) => p.id !== session.userId)?.id ?? null
      : null;
  const clientContext = await getThreadClientContext(otherProfileId).catch(() => null);

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-7rem)] md:h-[calc(100vh-5rem)]">
      <PageHeader
        title="Messages"
        subtitle="Chat, requests, invoices and reminders — all in one place per person."
      />
      <ChatLayout
        threads={threads}
        activeThreadId={activeThread?.id ?? null}
        initialMessages={initialMessages}
        sessionUserId={session.userId}
        sessionRole={session.role}
        clientContext={clientContext}
      />
    </div>
  );
}
