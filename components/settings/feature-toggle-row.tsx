"use client";

// One row of the Settings → Features toggle list. Wraps a Switch
// connected to the server action, so toggling persists immediately
// without needing a Save button.
//
// Optimistic UI: the switch flips locally as soon as the user taps,
// then we await the server action and revert on error.

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useState } from "react";
import { toggleFeatureAction, type ToggleState } from "@/app/dashboard/settings/features/actions";
import type { FeatureKey } from "@/services/features";

const initial: ToggleState = { error: null };

export function FeatureToggleRow({
  featureKey,
  label,
  description,
  enabled,
}: {
  featureKey: FeatureKey;
  label:       string;
  description: string;
  enabled:     boolean;
}) {
  const [state, dispatch] = useFormState<ToggleState, FormData>(toggleFeatureAction, initial);
  const [optimistic, setOptimistic] = useState(enabled);

  // Reset optimistic when server prop reconciles or error reverts
  useEffect(() => { setOptimistic(enabled); }, [enabled]);
  useEffect(() => {
    if (state.error) setOptimistic(enabled);
  }, [state.error, enabled]);

  function onSubmit(fd: FormData) {
    const newVal = !optimistic;
    setOptimistic(newVal);
    fd.set("key", featureKey);
    fd.set("value", String(newVal));
    dispatch(fd);
  }

  return (
    <li className="px-5 py-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy-900">{label}</p>
        <p className="text-[12.5px] text-ink-500 mt-1 leading-relaxed">
          {description}
        </p>
        {state.error && (
          <p className="text-[12px] text-rose-700 mt-2" role="alert">
            {state.error}
          </p>
        )}
      </div>
      <form action={onSubmit} className="shrink-0 mt-0.5">
        <Switch enabled={optimistic} ariaLabel={`Toggle ${label}`} />
      </form>
    </li>
  );
}

function Switch({ enabled, ariaLabel }: { enabled: boolean; ariaLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      disabled={pending}
      className={`
        relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40
        disabled:opacity-60
        ${enabled ? "bg-brand-600" : "bg-ink-200"}
      `}
    >
      <span
        aria-hidden
        className={`
          pointer-events-none inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow-sm
          transition-transform
          ${enabled ? "translate-x-[22px]" : "translate-x-0.5"}
        `}
      />
    </button>
  );
}
