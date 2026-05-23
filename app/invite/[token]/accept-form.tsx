"use client";

import { useFormState, useFormStatus } from "react-dom";
import { acceptInviteAction, type AcceptInviteState } from "./actions";

const initial: AcceptInviteState = { error: null };

export function AcceptInviteForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction] = useFormState<AcceptInviteState, FormData>(
    acceptInviteAction,
    initial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <Field
        label="Email"
        name="email_display"
        type="email"
        defaultValue={email}
        disabled
        helper="The trainer set your email — sign in with this address."
      />

      <Field
        label="Your full name"
        name="full_name"
        type="text"
        required
        autoComplete="name"
        helper="Shown to your trainer in the app."
      />

      <Field
        label="Phone number"
        name="phone"
        type="tel"
        required
        autoComplete="tel"
        helper="Your trainer uses this to text you reminders and reach you about lessons."
      />

      <Field
        label="Set password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        helper="At least 8 characters."
      />

      <Field
        label="Confirm password"
        name="confirm"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
      />

      {state.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Field({
  label,
  helper,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helper?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-700 font-medium">{label}</span>
      <input
        className="border border-neutral-300 rounded-md px-3 py-2 text-sm placeholder:text-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-500"
        {...rest}
      />
      {helper && <span className="text-xs text-neutral-500">{helper}</span>}
    </label>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 w-full rounded-md bg-emerald-700 text-white py-2.5 text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Setting up your account…" : "Set password & continue"}
    </button>
  );
}
