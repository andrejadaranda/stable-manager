"use client";

// Inline "Respond" dialog the stable owner uses to acknowledge,
// schedule, mark done, or decline a care request from a horse-owner
// client. Submit posts to /dashboard/care-requests/actions.ts then
// revalidates the inbox.

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { respondCareRequestAction } from "@/app/dashboard/care-requests/actions";
import type { CareRequestStatus } from "@/services/careRequests.types";
import { Button, Field, Input, Textarea } from "@/components/ui";

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
          bg-navy-900 text-white hover:bg-navy-800 transition-colors
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

  // Close on ESC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="respond-care-title"
      className="fixed inset-0 z-40 flex items-stretch sm:items-start sm:justify-center sm:pt-10 bg-ink-900/40 backdrop-blur-sm"
    >
      <form
        action={async (fd) => {
          await respondCareRequestAction(fd);
          onClose();
        }}
        className="
          bg-white border border-ink-100 flex flex-col w-full
          h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-5rem)]
          sm:rounded-2xl sm:shadow-soft sm:max-w-md
        "
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-ink-100 shrink-0">
          <div>
            <h2
              id="respond-care-title"
              className="font-display text-xl text-navy-700 leading-tight"
            >
              Respond to request
            </h2>
            <p className="text-[12.5px] text-ink-500 mt-1 leading-relaxed">
              Pick a status and (optionally) leave a short message for the
              horse owner.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-900 hover:bg-ink-100/60 transition-colors"
          >
            <span aria-hidden className="text-base">✕</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <input type="hidden" name="request_id" value={requestId} />
          <input type="hidden" name="status"     value={status} />

          <div>
            <span className="text-[12px] font-medium text-ink-700 block mb-2">
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
                        ? "bg-brand-50 border-brand-300 text-brand-800 ring-1 ring-brand-200"
                        : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50/60"}
                    `}
                  >
                    {LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {status === "scheduled" && (
            <Field label="Scheduled date" required>
              <Input type="date" name="scheduled_for" required />
            </Field>
          )}

          <Field
            label="Message to horse owner"
            hint="Optional. E.g. 'Booked the farrier for Tuesday morning'."
          >
            <Textarea name="response" rows={3} maxLength={500} />
          </Field>
        </div>

        <div
          className="
            shrink-0 border-t border-ink-100
            px-6 py-3 sm:py-4
            pb-[max(0.75rem,env(safe-area-inset-bottom))]
            flex items-center justify-end gap-2
          "
        >
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}

const LABEL: Record<CareRequestStatus, string> = {
  pending:      "Pending",
  acknowledged: "Acknowledged",
  scheduled:    "Schedule date",
  done:         "Done",
  declined:     "Decline",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="md" loading={pending}>
      {pending ? "Saving…" : "Save response"}
    </Button>
  );
}
