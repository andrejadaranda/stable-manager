"use client";

// Owner-only services manager.
//
// Renders an inline "+ Add service" form on top, then a list of
// existing services with edit + activate/deactivate + delete.
//
// Keeps the UX shallow — there's no separate detail page for services,
// since each row is just (name, price, duration, description). Inline
// is enough.

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createServiceAction,
  updateServiceAction,
  deleteServiceAction,
  type ServiceActionState,
} from "@/app/dashboard/settings/services/actions";
import type { ServiceRow } from "@/services/services";

const initialState: ServiceActionState = { error: null, success: false };

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

export function ServicesManager({ services }: { services: ServiceRow[] }) {
  return (
    <div className="flex flex-col gap-5">
      <CreateServiceCard />
      <ServiceList services={services} />
    </div>
  );
}

// =============================================================
// Create
// =============================================================
function CreateServiceCard() {
  const [state, action] = useFormState<ServiceActionState, FormData>(
    createServiceAction, initialState,
  );
  const [open, setOpen] = useState(false);

  // Reset the form on success so a quick second add starts blank.
  useEffect(() => { if (state.success) setOpen(false); }, [state.success]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          self-start h-10 px-4 rounded-xl text-sm font-medium
          bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
          transition-colors
        "
      >
        + Add service
      </button>
    );
  }

  return (
    <form
      action={action}
      className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-3"
    >
      <p className="text-sm font-semibold text-navy-900">New service</p>
      <FieldRow>
        <FormField label="Name" name="name" required placeholder="e.g. Private lesson · 60 min" />
        <FormField label="Price · €" name="base_price" type="number" min="0" step="0.01" required />
      </FieldRow>
      <FieldRow>
        <FormField
          label="Default duration (min)"
          name="default_duration_minutes"
          type="number"
          min="5"
          step="5"
          defaultValue="45"
        />
        <FormField
          label="Sort order"
          name="sort_order"
          type="number"
          step="1"
          defaultValue="0"
          hint="Lower = higher in the list."
        />
      </FieldRow>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">
          Description (optional)
        </span>
        <textarea
          name="description"
          rows={2}
          maxLength={500}
          className="
            rounded-xl border border-ink-200 bg-white text-sm text-ink-900
            placeholder:text-ink-400 px-3 py-2.5
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        />
      </label>

      <p
        role="alert"
        aria-live="polite"
        className={
          state.error
            ? "text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
            : "sr-only"
        }
      >
        {state.error || ""}
      </p>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60"
        >
          Cancel
        </button>
        <SubmitButton label="Create" />
      </div>
    </form>
  );
}

// =============================================================
// List
// =============================================================
function ServiceList({ services }: { services: ServiceRow[] }) {
  if (services.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        No services yet. Add one to start using the price list in the calendar.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {services.map((s) => (
        <ServiceRowCard key={s.id} service={s} />
      ))}
    </ul>
  );
}

function ServiceRowCard({ service }: { service: ServiceRow }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li>
        <EditServiceForm service={service} onClose={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li>
      <div className="bg-white rounded-2xl shadow-soft p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-semibold text-navy-900 truncate">{service.name}</p>
            {!service.active && (
              <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
                Inactive
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-ink-500 mt-0.5">
            {FMT_EUR.format(Number(service.base_price))} · {service.default_duration_minutes} min
            {service.description ? ` · ${service.description}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="h-9 px-3 rounded-xl text-xs font-medium text-ink-700 hover:bg-ink-100/60"
        >
          Edit
        </button>
        <DeleteServiceButton id={service.id} />
      </div>
    </li>
  );
}

// =============================================================
// Edit
// =============================================================
function EditServiceForm({
  service,
  onClose,
}: {
  service: ServiceRow;
  onClose: () => void;
}) {
  const [state, action] = useFormState<ServiceActionState, FormData>(
    updateServiceAction, initialState,
  );
  const [active, setActive] = useState(service.active);

  useEffect(() => { if (state.success) onClose(); }, [state.success, onClose]);

  return (
    <form
      action={action}
      className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-3"
    >
      <input type="hidden" name="service_id" value={service.id} />
      <input type="hidden" name="active"     value={String(active)} />

      <FieldRow>
        <FormField label="Name" name="name" required defaultValue={service.name} />
        <FormField label="Price · €" name="base_price" type="number" min="0" step="0.01" required defaultValue={Number(service.base_price).toFixed(2)} />
      </FieldRow>
      <FieldRow>
        <FormField
          label="Default duration (min)"
          name="default_duration_minutes"
          type="number"
          min="5"
          step="5"
          defaultValue={String(service.default_duration_minutes)}
        />
        <FormField
          label="Sort order"
          name="sort_order"
          type="number"
          step="1"
          defaultValue={String(service.sort_order)}
        />
      </FieldRow>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">
          Description (optional)
        </span>
        <textarea
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={service.description ?? ""}
          className="
            rounded-xl border border-ink-200 bg-white text-sm text-ink-900
            placeholder:text-ink-400 px-3 py-2.5
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        />
      </label>

      <label className="flex items-center gap-2.5 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-ink-700">Active — show in calendar + portal</span>
      </label>

      <p
        role="alert"
        aria-live="polite"
        className={
          state.error
            ? "text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
            : "sr-only"
        }
      >
        {state.error || ""}
      </p>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60"
        >
          Cancel
        </button>
        <SubmitButton label="Save" />
      </div>
    </form>
  );
}

// =============================================================
// Delete
// =============================================================
function DeleteServiceButton({ id }: { id: string }) {
  const [state, action] = useFormState<ServiceActionState, FormData>(
    deleteServiceAction, initialState,
  );
  return (
    <form action={action} title={state.error ?? undefined}>
      <input type="hidden" name="service_id" value={id} />
      <DeleteSubmit />
    </form>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm("Delete this service? Lessons that referenced it stay; the link clears.")) e.preventDefault();
      }}
      className="h-9 px-3 rounded-xl text-xs text-ink-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition-colors"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}

// =============================================================
// Primitives
// =============================================================
function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function FormField(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string },
) {
  const { label, hint, ...rest } = props;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">{label}</span>
      <input
        className="
          rounded-xl border border-ink-200 bg-white text-sm text-ink-900
          placeholder:text-ink-400 px-3 py-2.5
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
        "
        {...rest}
      />
      {hint && <span className="text-[11px] text-ink-500 mt-0.5">{hint}</span>}
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-10 px-5 rounded-xl text-sm font-medium
        bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
