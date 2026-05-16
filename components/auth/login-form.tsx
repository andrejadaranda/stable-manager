"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import { Field, Input, Button } from "@/components/ui";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation";

const initial: ActionState = { error: null };

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initial);
  const isUnconfirmed = state.code === "unconfirmed";

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="mb-1">
          <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
            Welcome back
          </h1>
          <p className="text-sm text-ink-500 mt-1">Sign in to your stable.</p>
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
          <p
            className={`text-sm rounded-lg px-3.5 py-2.5 border ${
              isUnconfirmed
                ? "text-amber-900 bg-amber-50 border-amber-200"
                : "text-rose-700 bg-rose-50 border-rose-200"
            }`}
          >
            {state.error}
          </p>
        )}
      </form>

      {/*
        When Supabase rejects the login with "Email not confirmed", surface
        the resend control inline. The email is taken from the failed login
        attempt so the user doesn't have to type it again.
      */}
      {isUnconfirmed && state.email && (
        <div className="pt-3 border-t border-ink-100">
          <ResendConfirmationForm defaultEmail={state.email} compact />
        </div>
      )}
    </div>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      loading={pending}
      variant="primary"
      size="lg"
      className="mt-1 w-full"
    >
      {pending ? "Signing in…" : label}
    </Button>
  );
}
