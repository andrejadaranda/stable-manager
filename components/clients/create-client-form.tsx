"use client";

// "+ New client" panel — premium brand UI.
//
// Trigger: button in the Clients page header.
// Modal: brand-styled. On mobile renders as a full-screen sheet (so the
// submit button stays reachable above iOS keyboard + home indicator); on
// desktop renders as a centered card with shadow-soft.
//
// Fields: full name (required), phone, email, lesson reminders, skill
// level, status, notes. Reminder dropdown auto-disables choices that don't
// have the required contact field filled in — so a user can't pick "SMS"
// before adding a phone number.

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createClientAction,
  type CreateClientState,
} from "@/app/dashboard/clients/actions";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

const initialState: CreateClientState = { error: null, success: false };

type ReminderPrefValue = "none" | "email" | "sms" | "both";

export function CreateClientPanel() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} size="md" variant="primary">
        + New client
      </Button>
      {open && <CreateClientDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function CreateClientDialog({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState<CreateClientState, FormData>(
    createClientAction,
    initialState,
  );

  // Local mirrors of the contact fields so we can conditionally enable
  // reminder channels. Server still re-validates — this is UX scaffolding.
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reminderPref, setReminderPref] = useState<ReminderPrefValue>("none");

  const hasEmail = email.trim().length > 0;
  const hasPhone = phone.trim().length > 0;

  const reminderHint = useMemo(() => {
    if (reminderPref === "email" && !hasEmail)
      return "Add an email above to enable email reminders.";
    if (reminderPref === "sms" && !hasPhone)
      return "Add a phone number above to enable SMS reminders.";
    if (reminderPref === "both" && (!hasEmail || !hasPhone))
      return "Both channels selected — fill in email AND phone above.";
    if (reminderPref === "sms" || reminderPref === "both")
      return "SMS dispatch is shipping with the June update — preference is saved now.";
    return null;
  }, [reminderPref, hasEmail, hasPhone]);

  // Auto-close on successful submit; list revalidates server-side.
  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  // Close on ESC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-client-title"
      className="fixed inset-0 z-40 flex items-stretch sm:items-start sm:justify-center sm:pt-10 bg-ink-900/40 backdrop-blur-sm"
    >
      <form
        action={formAction}
        className="
          bg-white border border-ink-100 flex flex-col w-full
          h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-5rem)]
          sm:rounded-2xl sm:shadow-soft sm:max-w-lg
        "
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-ink-100 shrink-0">
          <div>
            <h2
              id="new-client-title"
              className="font-display text-xl text-navy-700 leading-tight"
            >
              New client
            </h2>
            <p className="text-[12.5px] text-ink-500 mt-1 leading-relaxed">
              Add a client. You can invite them to the app from their profile
              once they're created.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-900 hover:bg-ink-100/60 transition-colors"
          >
            <span aria-hidden className="text-base">✕</span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <Field label="Full name" required>
            <Input
              name="full_name"
              type="text"
              required
              autoFocus
              placeholder="Lukas Becker"
              maxLength={120}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone">
              <Input
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.currentTarget.value)}
                placeholder="+37061234567"
                maxLength={32}
              />
            </Field>
            <Field label="Email">
              <Input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                placeholder="name@example.com"
                maxLength={254}
              />
            </Field>
          </div>

          <Field
            label="Lesson reminders"
            hint={reminderHint ?? "Email reminders fire 24h before each lesson. SMS is on the roadmap."}
          >
            <Select
              name="reminder_pref"
              value={reminderPref}
              onChange={(e) =>
                setReminderPref(e.currentTarget.value as ReminderPrefValue)
              }
            >
              <option value="none">Don&apos;t send reminders</option>
              <option value="email" disabled={!hasEmail}>
                Email {hasEmail ? "" : "— add email first"}
              </option>
            </Select>
          </Field>

          <Field
            label="Riding skill level"
            hint="Helps trainers match the right horse and lesson plan. Edit any time from the client profile."
          >
            <Select name="skill_level" defaultValue="">
              <option value="">— Select skill level —</option>
              <option value="beginner">Beginner — first months in the saddle</option>
              <option value="intermediate">Intermediate — confident at walk, trot, canter</option>
              <option value="advanced">Advanced — competing or jumping confidently</option>
              <option value="pro">Pro — competitive rider, multiple disciplines</option>
            </Select>
          </Field>
          {/* status defaults to 'active' server-side. Inactive toggle lives on the client edit dialog. */}
          <input type="hidden" name="status" value="active" />

          <Field label="Notes">
            <Textarea
              name="notes"
              rows={3}
              placeholder="Allergies, preferred trainer, anything the team should know…"
              maxLength={1000}
            />
          </Field>

          {state.error && (
            <p
              role="alert"
              className="text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5 leading-relaxed"
            >
              {state.error}
            </p>
          )}
        </div>

        {/* Sticky footer — always visible above iOS safe-area inset. */}
        <div
          className="
            shrink-0 border-t border-ink-100
            px-6 py-3 sm:py-4
            pb-[max(0.75rem,env(safe-area-inset-bottom))]
            flex items-center justify-end gap-2
          "
        >
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="md" loading={pending}>
      {pending ? "Creating…" : "Create client"}
    </Button>
  );
}
