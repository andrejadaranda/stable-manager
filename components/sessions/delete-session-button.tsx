"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteSessionAction,
  type DeleteSessionState,
} from "@/app/dashboard/sessions/actions";

const initialState: DeleteSessionState = { error: null, success: false };

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const [state, formAction] = useActionState(deleteSessionAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="session_id" value={sessionId} />
      <DeleteBtn />
      {state.error && (
        <span className="ml-2 text-xs text-rose-700">{state.error}</span>
      )}
    </form>
  );
}

function DeleteBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm("Delete this session?")) e.preventDefault();
      }}
      className="text-xs font-medium text-ink-500 hover:text-rose-700 disabled:opacity-50 transition-colors"
      aria-label="Delete session"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
