"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import { Field, Input, Button } from "@/components/ui";

const initial: ActionState = { error: null };

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initial);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="mb-1">
        <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
          Welcome back
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          Sign in to your stable.
        </p>
      </div>

      <Field label="Email" required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@stable.com"
        />
      </Field>

      <Field label="Password" required>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Submit label="Sign in" />

      {state.error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5">
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
      {pending ? "Signing in…" : label}
    </Button>
  );
}
