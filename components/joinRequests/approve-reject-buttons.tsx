"use client";

// Approve = one click + confirm; auto-creates the client and emails
// the invitation. Reject opens a sheet so the owner can leave a
// short reason that gets stored on the row.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  approveJoinAction,
  rejectJoinAction,
  type JoinResponseState,
} from "@/app/dashboard/join-requests/actions";

const initial: JoinResponseState = { error: null, success: false };

export function ApproveRejectButtons({
  requestId,
  applicantName,
}: {
  requestId:     string;
  applicantName: string;
}) {
  const [openReject, setOpenReject] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <ApproveForm requestId={requestId} applicantName={applicantName} />
        <button
          type="button"
          onClick={() => setOpenReject(true)}
          className="h-8 px-3 rounded-lg text-[12px] font-medium bg-white border border-ink-200 text-ink-700 hover:bg-ink-50"
        >
          Reject
        </button>
      </div>
      {openReject && (
        <RejectDialog requestId={requestId} onClose={() => setOpenReject(false)} />
      )}
    </>
  );
}

function ApproveForm({
  requestId,
  applicantName,
}: {
  requestId: string;
  applicantName: string;
}) {
  const [state, formAction] = useFormState<JoinResponseState, FormData>(
    approveJoinAction,
    initial,
  );
  const [confirmed, setConfirmed] = useState(false);

  // After success, briefly show toast text inline — re-render comes
  // from revalidatePath so the row disappears from the Open bucket
  // automatically.
  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => setConfirmed(false), 4000);
      return () => clearTimeout(t);
    }
  }, [state.success]);

  return (
    <>
      <form
        action={(fd) => {
          setConfirmed(true);
          return formAction(fd);
        }}
      >
        <input type="hidden" name="request_id" value={requestId} />
        <ApproveSubmit />
      </form>
      {state.success && confirmed && (
        <span className="text-[11.5px] text-emerald-700">
          ✓ {applicantName} added{state.emailSent ? " · invite sent" : " · copy invite from Clients"}
        </span>
      )}
      {state.error && (
        <span className="text-[11.5px] text-red-700">{state.error}</span>
      )}
    </>
  );
}

function ApproveSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-8 px-3 rounded-lg text-[12px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      {pending ? "Approving…" : "Approve & invite"}
    </button>
  );
}

function RejectDialog({
  requestId,
  onClose,
}: {
  requestId: string;
  onClose:   () => void;
}) {
  const [state, formAction] = useFormState<JoinResponseState, FormData>(
    rejectJoinAction,
    initial,
  );

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <form
      action={formAction}
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
          <h2 className="text-lg font-semibold">Reject application</h2>
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

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">
              Reason <span className="text-neutral-400 font-normal">(optional, stored with the record)</span>
            </span>
            <textarea
              name="reason"
              rows={3}
              placeholder="e.g. Stable is at capacity — try again next quarter."
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
            <span className="text-[11px] text-neutral-500">
              Not emailed to the applicant — for your internal records.
            </span>
          </label>

          {state.error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {state.error}
            </p>
          )}
        </div>

        <div
          className="
            shrink-0 border-t border-neutral-100 sm:border-0
            px-5 sm:px-6 py-3 sm:py-2 sm:pb-6
            pb-[max(0.75rem,env(safe-area-inset-bottom))]
          "
        >
          <RejectSubmit />
        </div>
      </div>
    </form>
  );
}

function RejectSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto rounded-md bg-brand-600 text-white py-3 sm:py-2.5 px-4 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Confirm reject"}
    </button>
  );
}
