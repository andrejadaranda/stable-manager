"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  inviteEmployeeAction,
  inviteClientAction,
  type InviteState,
} from "@/app/dashboard/team/actions";

const inviteInitialState: InviteState = { error: null, success: null };

type ClientOpt = { id: string; full_name: string };

// ----------------------------------------------------------------
// Employee invite
// ----------------------------------------------------------------
export function InviteEmployeePanel() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800"
      >
        + Invite employee
      </button>
      {open && <InviteEmployeeForm onClose={() => setOpen(false)} />}
    </>
  );
}

function InviteEmployeeForm({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState<InviteState, FormData>(
    inviteEmployeeAction, inviteInitialState,
  );
  return (
    <FormShell title="Invite employee" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        <Field label="Full name" name="full_name" required />
        <Field label="Email" name="email" type="email" required />
        <Field
          label="Initial password"
          name="password"
          type="text"
          minLength={8}
          required
          defaultValue={generatePassword()}
        />
        <p className="text-xs text-neutral-500 -mt-1">
          You&apos;ll share this password with the new employee. They sign in at /login.
        </p>
        <Submit label="Invite employee" pendingLabel="Inviting…" />
        <Result state={state} onSuccess={onClose} />
      </form>
    </FormShell>
  );
}

// ----------------------------------------------------------------
// Client invite (links to an existing clients row)
// ----------------------------------------------------------------
export function InviteClientPanel({
  unlinkedClients,
}: {
  unlinkedClients: ClientOpt[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-white border border-neutral-300 text-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
      >
        + Invite client
      </button>
      {open && (
        <InviteClientForm
          unlinkedClients={unlinkedClients}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function InviteClientForm({
  unlinkedClients,
  onClose,
}: {
  unlinkedClients: ClientOpt[];
  onClose: () => void;
}) {
  const [state, formAction] = useFormState<InviteState, FormData>(
    inviteClientAction, inviteInitialState,
  );

  if (unlinkedClients.length === 0) {
    return (
      <FormShell title="Invite client" onClose={onClose}>
        <p className="text-sm text-neutral-700">
          Every active client already has a portal account.
        </p>
        <p className="text-xs text-neutral-500 mt-2">
          To grant portal access to a new person, first add them on the{" "}
          <span className="font-medium">Clients</span> page, then come back here.
        </p>
      </FormShell>
    );
  }

  return (
    <FormShell title="Invite client" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-700 font-medium">Client record</span>
          <select
            name="client_id"
            required
            defaultValue=""
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="" disabled>Select…</option>
            {unlinkedClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">
            Only active clients without an existing portal account are listed.
          </span>
        </label>
        <Field label="Their full name (for portal display)" name="full_name" required />
        <Field label="Email" name="email" type="email" required />
        <Field
          label="Initial password"
          name="password"
          type="text"
          minLength={8}
          required
          defaultValue={generatePassword()}
        />
        <Submit label="Grant portal access" pendingLabel="Inviting…" />
        <Result state={state} onSuccess={onClose} />
      </form>
    </FormShell>
  );
}

// ----------------------------------------------------------------
// Shared primitives
// ----------------------------------------------------------------
function FormShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-neutral-200 p-6 w-full max-w-md flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
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
        className="border border-neutral-300 rounded-md px-3 py-2 text-sm placeholder:text-neutral-400"
        {...rest}
      />
    </label>
  );
}

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Result({
  state,
  onSuccess,
}: {
  state: InviteState;
  onSuccess: () => void;
}) {
  // Auto-close on success after a beat — but show the password first
  useEffect(() => {
    if (!state.success) return;
    const t = setTimeout(onSuccess, 8000);
    return () => clearTimeout(t);
  }, [state.success, onSuccess]);

  if (state.error) {
    return (
      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 break-words">
        {state.success}
      </p>
    );
  }
  return null;
}

function generatePassword() {
  // 12-char human-friendly password (no l/1/O/0)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const arr = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  }
  for (let i = 0; i < 12; i++) {
    s += alphabet[arr[i] % alphabet.length];
  }
  return s;
}
