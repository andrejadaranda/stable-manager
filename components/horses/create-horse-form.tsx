"use client";

// "+ New horse" panel — premium brand UI.
//
// Trigger: button in the Horses page header.
// Modal: rounded-2xl card with shadow-soft, brand emerald button, branded
// field labels with required asterisk, helper text, error tone-token.
//
// Fields:
//   - Name (required)
//   - Breed (optional)
//   - Date of birth (optional, browser-native picker)
//   - Owner client (optional — picks an EXISTING client to mark this as a
//     boarder horse; empty = stable-owned/lesson horse)
//   - Photo URL (optional — paste a hosted URL; richer avatar uploader lives
//     on the horse profile page after creation)
//   - Status (active / inactive)
//   - Max lessons per day (default 4)
//   - Max lessons per week (default 20)
//   - Notes (optional)
//
// All inputs use the shared <Field> + <Input>/<Select>/<Textarea>
// primitives so styling stays consistent with the rest of the app.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createHorseAction,
  type CreateHorseState,
} from "@/app/dashboard/horses/actions";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";

const initialState: CreateHorseState = { error: null, success: false };

export type ClientOpt = { id: string; full_name: string };

export function CreateHorsePanel({ clients = [] }: { clients?: ClientOpt[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        size="md"
        variant="primary"
      >
        + New horse
      </Button>
      {open && (
        <CreateHorseDialog clients={clients} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function CreateHorseDialog({
  clients,
  onClose,
}: {
  clients: ClientOpt[];
  onClose: () => void;
}) {
  const [state, formAction] = useFormState<CreateHorseState, FormData>(
    createHorseAction,
    initialState,
  );

  // Auto-close on success. The horses list revalidates server-side so the
  // new row will already be visible when the dialog disappears.
  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  // Close on ESC. Click-outside is intentionally NOT implemented — the form
  // can contain a lot of input; an accidental backdrop click shouldn't wipe
  // 30 seconds of typing.
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
      aria-labelledby="new-horse-title"
      className="fixed inset-0 z-40 flex items-start justify-center pt-10 sm:pt-16 px-4 bg-ink-900/40 backdrop-blur-sm overflow-y-auto"
    >
      <form
        action={formAction}
        className="bg-white rounded-2xl shadow-soft border border-ink-100 w-full max-w-lg p-6 sm:p-7 flex flex-col gap-5 my-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="new-horse-title"
              className="font-display text-xl text-navy-700 leading-tight"
            >
              New horse
            </h2>
            <p className="text-[12.5px] text-ink-500 mt-1 leading-relaxed">
              Add a horse to the stable. You can edit every field later from
              the horse profile.
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

        <div className="flex flex-col gap-4">
          <Field label="Name" required>
            <Input
              name="name"
              type="text"
              required
              autoFocus
              placeholder="Bingo"
              maxLength={80}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Breed">
              <Input
                name="breed"
                type="text"
                placeholder="Lithuanian heavy draft"
                maxLength={80}
              />
            </Field>
            <Field label="Date of birth" hint="Used for age in welfare reports.">
              <Input name="date_of_birth" type="date" max="2099-12-31" />
            </Field>
          </div>

          <Field
            label="Owner (boarding horse)"
            hint="Leave empty for stable-owned lesson horses."
          >
            <Select name="owner_client_id" defaultValue="">
              <option value="">— Stable-owned (no client owner) —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Photo URL"
            hint="Optional. Use a hosted image URL — richer photo upload lives on the horse profile."
          >
            <Input
              name="photo_url"
              type="url"
              placeholder="https://…"
              inputMode="url"
            />
          </Field>

          <div className="rounded-xl border border-ink-200/70 bg-cream-50/40 px-4 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-600 mb-1">
              Workload &amp; availability
            </p>
            <p className="text-[12.5px] text-ink-500 leading-relaxed mb-3">
              These caps protect the horse from being overbooked. The welfare board flags any horse that hits them — and the calendar refuses double-bookings beyond the limit. Set <strong>0</strong> on either field to disable that check entirely.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field
                label="Status"
                hint="Active = available for lessons. Inactive = hidden from the calendar (e.g. injured, sold, on holiday)."
              >
                <Select name="status" defaultValue="active">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
              <Field
                label="Max lessons / day"
                hint="How many lessons this horse can carry in a single day before the welfare board flags it. Typical: 3–4. Use 0 = no limit."
              >
                <Input
                  name="daily_lesson_limit"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="4"
                />
              </Field>
              <Field
                label="Max lessons / week"
                hint="Weekly workload cap. Welfare board flags horses over this. Typical: 15–20. Use 0 = no limit."
              >
                <Input
                  name="weekly_lesson_limit"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="20"
                />
              </Field>
            </div>
          </div>

          <Field label="Notes">
            <Textarea
              name="notes"
              rows={3}
              placeholder="Quirks, vet notes, things only the team should see…"
              maxLength={1000}
            />
          </Field>
        </div>

        {state.error && (
          <p
            role="alert"
            className="text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5 leading-relaxed"
          >
            {state.error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
          >
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
      {pending ? "Creating…" : "Create horse"}
    </Button>
  );
}
