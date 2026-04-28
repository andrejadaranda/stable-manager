"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signupOwnerAction, type ActionState } from "@/lib/auth/actions";
import { Field, Input, Button } from "@/components/ui";

const initial: ActionState = { error: null };

export function SignupOwnerForm() {
  const [state, formAction] = useFormState(signupOwnerAction, initial);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="mb-1">
        <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
          Create your stable
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          First-owner signup — your stable and account in one step.
        </p>
      </div>

      <Field label="Your name" required>
        <Input
          name="full_name"
          type="text"
          autoComplete="name"
          required
          placeholder="Jonas Petraitis"
        />
      </Field>

      <Field label="Stable name" required>
        <Input
          name="stable_name"
          type="text"
          required
          placeholder="Pajurio Žirgynas"
          maxLength={80}
        />
      </Field>

      <Field
        label="Stable handle"
        hint="Lowercase letters, digits, hyphens. 2–40 characters."
        required
      >
        <Input
          name="stable_slug"
          type="text"
          autoCapitalize="none"
          spellCheck={false}
          required
          pattern="[a-z0-9-]{2,40}"
          title="2-40 lowercase letters, digits, or hyphens"
          placeholder="pajurio-zirgynas"
        />
      </Field>

      <Field label="Email" required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@stable.com"
        />
      </Field>

      <Field label="Password" hint="Minimum 8 characters." required>
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      <Submit label="Create stable" />

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
      {pending ? "Creating…" : label}
    </Button>
  );
}
