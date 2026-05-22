"use client";

import { useFormState, useFormStatus } from "react-dom";
import { requestPasswordResetAction, type ActionState } from "@/lib/auth/actions";
import { Field, Input, Button } from "@/components/ui";

const initial: ActionState = { error: null };

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(requestPasswordResetAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="mb-1">
        <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
          Reset your password
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          Enter the email on your stable. We&rsquo;ll send a link to set a new password.
        </p>
      </div>

      <Field label="Email" required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email ?? ""}
          placeholder="you@stable.com"
        />
      </Field>

      <Submit label="Send reset link" />

      {state.error && (
        <p className="text-sm rounded-lg px-3.5 py-2.5 border text-rose-700 bg-rose-50 border-rose-200">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} variant="primary" size="lg" className="mt-1 w-full">
      {pending ? "Sending…" : label}
    </Button>
  );
}
