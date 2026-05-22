"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updatePasswordAction, type ActionState } from "@/lib/auth/actions";
import { Field, Input, Button } from "@/components/ui";

const initial: ActionState = { error: null };

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(updatePasswordAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="mb-1">
        <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
          Set a new password
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          Pick something at least 8 characters. We&rsquo;ll sign you in once it&rsquo;s saved.
        </p>
      </div>

      <Field label="New password" required>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
        />
      </Field>

      <Field label="Confirm new password" required>
        <Input
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      <Submit label="Save and sign in" />

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
      {pending ? "Saving…" : label}
    </Button>
  );
}
