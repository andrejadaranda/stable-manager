"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signupOwnerAction, type ActionState } from "@/lib/auth/actions";

const initial: ActionState = { error: null };

export function SignupOwnerForm() {
  const [state, formAction] = useFormState(signupOwnerAction, initial);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold mb-1">Create your stable</h1>
      <p className="text-xs text-neutral-500 -mt-1 mb-2">
        First-owner signup. Provisions the stable and your account in one step.
      </p>

      <Field label="Your name"    name="full_name"   type="text"   autoComplete="name" />
      <Field label="Stable name"  name="stable_name" type="text" />
      <Field
        label="Stable slug"
        name="stable_slug"
        type="text"
        autoCapitalize="none"
        spellCheck={false}
        pattern="[a-z0-9-]{2,40}"
        title="2-40 lowercase letters, digits, or hyphens"
      />

      <Field label="Email"        name="email"       type="email"    autoComplete="email" />
      <Field label="Password"     name="password"    type="password" autoComplete="new-password" minLength={8} />

      <Submit label="Create stable" />
      {state.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string },
) {
  const { label, ...rest } = props;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-700 font-medium">{label}</span>
      <input
        required
        className="border border-neutral-300 rounded-md px-3 py-2 text-sm placeholder:text-neutral-400"
        {...rest}
      />
    </label>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Creating…" : label}
    </button>
  );
}
