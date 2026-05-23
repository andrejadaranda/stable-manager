"use client";

// Inline "Respond" dialog the stable owner uses to acknowledge,
// schedule, mark done, or decline a care request from a horse-owner
// client. Submit posts to /dashboard/care-requests/actions.ts then
// revalidates the inbox.

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { respondCareRequestAction } from "@/app/dashboard/care-requests/actions";
import type { CareRequestStatus } from "@/services/careRequests";

export function RespondButton({
  requestId,
  defaultStatus = "acknowledged",
}: {
  requestId: string;
  defaultStatus?: CareRequestStatus;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          h-8 px-3 rounded-lg text-[12px] font-medium
          bg-navy-900 text-white hover:bg-navy-800
        "
      >
        Respond
      </button>
      {open && (
        <Dialog
          requestId={requestId}
          defaultStatus={defaultStatus}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function Dialog({
  requestId,
  defaultStatus,
  onClose,
}: {
  requestId: string;
  defaultStatus: CareRequestStatus;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<CareRequestStatus>(
    defaultStatus === "pending" ? "acknowledged" : defaultStatus,
  );

  return (
    <form
      action={async (fd) => {
        await respondCareRequestAction(fd);
        onClose();
      }}
      className="fixed inset-0 z-30 flex items-stretch sm:items-start sm:justify-center sm:pt-16 bg-black/40 backdrop-blur-sm"
    >
      <div
        className="
          bg-white border border-neutral-200 flex flex-col w-full
          h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-5rem)]
          sm:rounded-xl sm:shadow-xl sm:max-w-md
        "
      >
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-neutral-100 sm:border-0 shrink-0">
          <h2 className="text-lg font-semibold">Respond to request</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-900 px-2 py-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 flex flex-col gap-4">
          <input type="hidden" name="request_id" value={requestId} />
          <input type="hidden" name="status"     value={status} />

          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 block mb-2">
              Status
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(["acknowledged", "scheduled", "done", "declined"] as const).map((s) => {
                const active = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`
                      rounded-xl px-3 py-2.5 text-sm font-medium border transition-colors text-left
                      ${active
                        ? "bg-brand-50 border-brand-300 text-brand-800"
                        : "bg-white border-neutral-200 text-ink-700 hover:bg-neutral-50"}
                    `}
                  >
                    {LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {status === "scheduled" && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-neutral-700 font-medium">Scheduled date</span>
              <input
                type="date"
                name="scheduled_for"
                className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">
              Message to horse owner <span className="text-neutral-400 font-normal">(optional)</span>
            </span>
            <textarea
              name="response"
              rows={3}
              placeholder="e.g. Booked the farrier for Tuesday morning…"
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div
          className="
            shrink-0 border-t border-neutral-100 sm:border-0
            px-5 sm:px-6 py-3 sm:py-2 sm:pb-6
            pb-[max(0.75rem,env(safe-area-inset-bottom))]
          "
        >
          <Submit />
        </div>
      </div>
    </form>
  );
}

const LABEL: Record<CareRequestStatus, string> = {
  pending:      "Pending",
  acknowledged: "Acknowledged",
  scheduled:    "Schedule date",
  done:         "Done",
  declined:     "Decline",
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto rounded-md bg-neutral-900 text-white py-3 sm:py-2.5 px-4 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Saving…" : "Save response"}
    </button>
  );
}
