"use client";

import { useFormState } from "react-dom";
import { useTransition } from "react";
import { deleteClientAction, type DeleteClientState } from "@/app/dashboard/clients/actions";

const initial: DeleteClientState = { error: null };

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const [state, dispatch] = useFormState(deleteClientAction, initial);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Delete this client permanently? Only possible if they have no lessons, horses, charges or payments. To keep the records, deactivate instead.")) return;
    const fd = new FormData();
    fd.set("client_id", clientId);
    startTransition(() => dispatch(fd));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="h-10 px-4 rounded-xl text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state.error && <span className="text-[11.5px] text-rose-700 max-w-[260px] text-right">{state.error}</span>}
    </div>
  );
}
