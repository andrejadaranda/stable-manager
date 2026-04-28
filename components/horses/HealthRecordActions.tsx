"use client";

// Tiny client buttons for per-row health-record actions: resolve an
// open injury, delete a record. Uses server actions; nothing fancy.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resolveInjuryAction,
  deleteHealthRecordAction,
} from "@/app/dashboard/horses/[id]/health-actions";

export function ResolveInjuryButton({
  recordId,
  horseId,
}: {
  recordId: string;
  horseId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("record_id", recordId);
      fd.set("horse_id", horseId);
      const res = await resolveInjuryAction({ error: null, success: false }, fd);
      if (!res.error) router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="text-[12px] text-rose-700 hover:text-rose-800 font-medium px-2.5 py-1 rounded-md hover:bg-rose-50 disabled:opacity-50"
    >
      {isPending ? "Resolving…" : "Mark resolved"}
    </button>
  );
}

export function DeleteHealthRecordButton({
  recordId,
  horseId,
}: {
  recordId: string;
  horseId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("Delete this health record? This cannot be undone.")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("record_id", recordId);
      fd.set("horse_id", horseId);
      const res = await deleteHealthRecordAction({ error: null, success: false }, fd);
      if (!res.error) router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-label="Delete record"
      className="text-ink-400 hover:text-rose-700 p-1 rounded transition-colors disabled:opacity-50 shrink-0"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}
