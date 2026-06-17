"use client";

// Personal account signup form.
// Captures plan tier (mini/plus) + name + email + password, then
// signs the user up via Supabase auth with personal account metadata
// so /auth/callback knows to call provision_personal_account RPC.

import { useFormState, useFormStatus } from "react-dom";
import { signupPersonalAction, type ActionState } from "@/lib/auth/actions";
import { Field, Input, Button } from "@/components/ui";

const initial: ActionState = { error: null };

export function SignupPersonalForm() {
  const [state, formAction] = useFormState(signupPersonalAction, initial);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Plan" required>
        <select
          name="plan_tier"
          required
          defaultValue="mini"
          className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="mini">Mini — free · up to 2 horses</option>
          <option value="plus">Plus — free · up to 5 horses</option>
        </select>
      </Field>

      <Field label="Your name" required>
        <Input
          name="full_name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          placeholder="e.g. Maria Schneider"
        />
      </Field>

      <Field label="Email" required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@email.com"
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

      {state.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} className="w-full">
      {pending ? "Creating account…" : "Create personal account"}
    </Button>
  );
}
