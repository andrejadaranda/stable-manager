"use client";

// One row in the post lists: what it says, where it is going, and what
// happened. Client-side because publishing and deleting need pending
// state and optimistic removal.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/personal/ui";
import { publishNowAction, deletePostAction } from "@/app/personal/social-actions";

type Media = { url: string; type: "image" | "video" };

export type PostRowData = {
  id: string;
  platforms: string[];
  content: string;
  media: Media[];
  status: string;
  externalIds: Record<string, string>;
  lastErrors: Record<string, string>;
  attempts: number;
};

const LABEL: Record<string, string> = {
  instagram_feed: "IG",
  instagram_story: "Story",
  facebook_page: "FB",
};

const STATUS: Record<string, { text: string; tone: "positive" | "warning" | "danger" | "neutral" | "brand" }> = {
  draft: { text: "juodraštis", tone: "neutral" },
  scheduled: { text: "suplanuota", tone: "brand" },
  publishing: { text: "siunčiama", tone: "warning" },
  published: { text: "paskelbta", tone: "positive" },
  partial: { text: "dalinai", tone: "warning" },
  failed: { text: "nepavyko", tone: "danger" },
};

export function PostRow({ post, when }: { post: PostRowData; when: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;

  const status = STATUS[post.status] ?? { text: post.status, tone: "neutral" as const };
  const errorEntries = Object.entries(post.lastErrors).filter(([k]) => k !== "_");
  const canPublishNow = ["draft", "scheduled", "partial", "failed"].includes(post.status);

  return (
    <div
      className={cn(
        "border-b border-ink-100 px-4 py-3 last:border-b-0 transition-opacity",
        pending && "opacity-40",
      )}
    >
      <div className="flex items-start gap-3">
        {post.media[0] ? (
          post.media[0].type === "video" ? (
            <video src={post.media[0].url} className="h-11 w-11 shrink-0 rounded-lg object-cover" muted />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.media[0].url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
          )
        ) : (
          <div className="h-11 w-11 shrink-0 rounded-lg bg-surface-muted" aria-hidden />
        )}

        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className="line-clamp-2 text-[13px] leading-snug text-ink-800">
            {post.content || "(be teksto)"}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
            {post.platforms.map((p) => (
              <span key={p} className="rounded bg-surface-muted px-1.5 py-0.5">
                {LABEL[p] ?? p}
              </span>
            ))}
            {when && <span>{when}</span>}
          </p>
        </button>

        <Chip tone={status.tone}>{status.text}</Chip>
      </div>

      {open && (
        <div className="mt-3 rounded-xl bg-surface-muted/70 p-3">
          {post.content && (
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-700">
              {post.content}
            </p>
          )}

          {errorEntries.length > 0 && (
            <ul className="mt-2 space-y-1">
              {errorEntries.map(([platform, msg]) => (
                <li key={platform} className="text-[11.5px] leading-snug text-rose-600">
                  {LABEL[platform] ?? platform}: {msg}
                </li>
              ))}
            </ul>
          )}

          {/* Partial success needs to be legible: which ones landed
              matters, because a retry only re-sends the rest. */}
          {Object.keys(post.externalIds).length > 0 && (
            <p className="mt-2 text-[11px] text-emerald-700">
              Išsiųsta: {Object.keys(post.externalIds).map((p) => LABEL[p] ?? p).join(", ")}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canPublishNow && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const result = await publishNowAction(post.id);
                    if (!result.ok) setError(result.error);
                    router.refresh();
                  })
                }
                className="rounded-full bg-brand-600 px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                {post.attempts > 0 ? "Bandyti dar kartą" : "Skelbti dabar"}
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setHidden(true);
                  const result = await deletePostAction(post.id);
                  if (!result.ok) {
                    setHidden(false);
                    setError(result.error);
                  }
                  router.refresh();
                })
              }
              className="rounded-full px-3 py-1.5 text-[12px] font-medium text-ink-500 active:text-ink-800"
            >
              Ištrinti
            </button>
          </div>

          {error && <p className="mt-2 text-[11px] text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
