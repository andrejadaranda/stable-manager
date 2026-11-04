"use client";

// Enable / disable the work-for-credit (barter) section for one client.
// Off by default — most clients never barter, so their profile stays clean.
// When off, this renders a single faint "enable" line; when on, a quiet
// "turn off" control sits under the barter panels.

import { useFormState, useFormStatus } from "react-dom";
import { toggleBarterEnabledAction, type BarterActionState } from "@/app/dashboard/clients/[id]/barter-actions";

const initial: BarterActionState = { error: null, success: false };

export function BarterToggle({ clientId, enabled }: { clientId: string; enabled: boolean }) {
  const [state, action] = useFormState(toggleBarterEnabledAction, initial);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <ToggleButton enabled={enabled} />
      {state.error && <span className="text-[12px] text-rose-700">{state.error}</span>}
    </form>
  );
}

function ToggleButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  if (enabled) {
    return (
      <button type="submit" disabled={pending}
        className="text-[12px] text-ink-400 hover:text-rose-600 disabled:opacity-50">
        {pending ? "…" : "Turn off work-for-credit for this client"}
      </button>
    );
  }
  return (
    <button type="submit" disabled={pending}
      className="text-[13px] font-medium text-brand-700 hover:text-brand-800 disabled:opacity-50">
      {pending ? "…" : "+ Enable work-for-credit (barter) for this client"}
    </button>
  );
}
