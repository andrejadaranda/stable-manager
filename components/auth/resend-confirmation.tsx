"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  resendConfirmationAction,
  type ResendState,
} from "@/lib/auth/actions";
import { Field, Input, Button } from "@/components/ui";

const initial: ResendState = { error: null, ok: false };

export function ResendConfirmationForm({
  defaultEmail = "",
  compact = false,
}: {
  defaultEmail?: string;
  compact?: boolean;
}) {
  const [state, formAction] = useFormState(resendConfirmationAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {!compact && (
        <Field label="Your email" required>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={defaultEmail}
            placeholder="you@stable.com"
          />
        </Field>
      )}
      {compact && (
        <input type="hidden" name="email" value={defaultEmail} />
      )}

      <Submit compact={compact} />

      {state.ok && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5">
          Confirmation email sent. Check your inbox (and spam).
        </p>
      )}
      {state.error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Submit({ compact }: { compact: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      loading={pending}
      variant={compact ? "ghost" : "primary"}
      size={compact ? "sm" : "md"}
      className={compact ? "" : "w-full"}
    >
      {pending ? "Sending…" : "Resend confirmation email"}
    </Button>
  );
}
