"use client";

// Client-side pieces of the command centre: the few places that need
// pending state, optimistic removal, or a native share/SMS handoff.
//
// Everything else on this dashboard is a server component — she opens
// this on a phone, often on mobile data, and shipping less JS is the
// single biggest thing that keeps it feeling instant.

import { useState, useTransition } from "react";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/personal/ui";
import type { ActionResult } from "@/app/personal/actions";

// -------------------------------------------------------------------
// Generic action button with pending + error state
// -------------------------------------------------------------------

export function ActionButton({
  action,
  children,
  pendingLabel,
  variant = "secondary",
  className,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const styles = {
    primary: "bg-brand-600 text-white active:bg-brand-700",
    secondary: "border border-ink-200 bg-white text-ink-700 active:bg-surface-muted",
    ghost: "text-ink-500 active:text-ink-800",
  }[variant];

  return (
    <div className={cn("inline-flex flex-col items-end gap-1", className)}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await action();
            if (!result.ok) setError(result.error);
          })
        }
        className={cn(
          "rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-tight",
          "transition-all duration-200 ease-soft disabled:opacity-50",
          styles,
        )}
      >
        {pending ? (pendingLabel ?? "Palauk…") : children}
      </button>
      {error && <span className="max-w-[24ch] text-right text-[10.5px] text-rose-600">{error}</span>}
    </div>
  );
}

// -------------------------------------------------------------------
// Re-engagement card
// -------------------------------------------------------------------

export type ReengagementItem = {
  clientId: string;
  fullName: string;
  phone: string | null;
  daysSince: number | null;
  tone: "never" | "overdue" | "due" | "ok";
  suggestedMessage: string;
};

/**
 * One client who has gone quiet, with the drafted message ready to send.
 *
 * The message opens in her own SMS app pre-filled rather than being sent
 * from the server: it keeps the conversation in the thread she already
 * has with that person, and it means she reads every message before it
 * goes out. An automated send would be faster and much worse.
 */
export function ReengagementCard({
  item,
  onDismiss,
}: {
  item: ReengagementItem;
  onDismiss: (clientId: string) => Promise<ActionResult>;
}) {
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  if (hidden) return null;

  const label =
    item.tone === "never"
      ? "Dar nejojo"
      : item.daysSince === null
      ? "—"
      : `${item.daysSince} d.`;

  const tone = item.tone === "overdue" ? "danger" : item.tone === "due" ? "warning" : "saddle";

  const smsHref = item.phone
    ? `sms:${item.phone.replace(/\s/g, "")}${smsSeparator()}body=${encodeURIComponent(item.suggestedMessage)}`
    : null;

  return (
    <div
      className={cn(
        "border-b border-ink-100 px-4 py-3 last:border-b-0",
        "transition-opacity duration-300",
        pending && "opacity-40",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-[14px] font-medium text-ink-900">{item.fullName}</p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {item.phone ?? "nėra telefono"}
          </p>
        </button>
        <Chip tone={tone}>{label}</Chip>
      </div>

      {open && (
        <div className="mt-3 rounded-xl bg-surface-muted/70 p-3">
          <p className="text-[12.5px] leading-relaxed text-ink-700">{item.suggestedMessage}</p>
          <div className="mt-3 flex items-center gap-2">
            {smsHref ? (
              <a
                href={smsHref}
                className="rounded-full bg-brand-600 px-3.5 py-1.5 text-[12px] font-semibold text-white active:bg-brand-700"
              >
                Rašyti SMS
              </a>
            ) : (
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(item.suggestedMessage)}
                className="rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-700"
              >
                Kopijuoti tekstą
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  // Optimistic: she has acted, the row should go now.
                  // If the write fails the next load brings it back —
                  // acceptable, and better than a spinner mid-list.
                  setHidden(true);
                  await onDismiss(item.clientId);
                })
              }
              className="rounded-full px-3 py-1.5 text-[12px] font-medium text-ink-500 active:text-ink-800"
            >
              Susisiekiau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// iOS wants `sms:number&body=`, everything else wants `?body=`. Getting
// this wrong opens the SMS app with an empty message, which quietly
// defeats the whole feature.
function smsSeparator(): string {
  if (typeof navigator === "undefined") return "?";
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? "&" : "?";
}

// -------------------------------------------------------------------
// Forms
// -------------------------------------------------------------------

export function ActionForm({
  action,
  children,
  submitLabel,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const form = e.currentTarget;
        start(async () => {
          setFeedback(null);
          const result = await action(formData);
          if (result.ok) {
            setFeedback({ ok: true, text: "Išsaugota." });
            // Clear password-ish fields so a shoulder-surfer can't read
            // a token back off the screen after saving.
            form.querySelectorAll("input[type=password]").forEach((el) => {
              (el as HTMLInputElement).value = "";
            });
          } else {
            setFeedback({ ok: false, text: result.error });
          }
        });
      }}
    >
      {children}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand-600 px-4 py-2 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-50 active:bg-brand-700"
        >
          {pending ? "Saugoma…" : submitLabel}
        </button>
        {feedback && (
          <span
            className={cn(
              "text-[11.5px]",
              feedback.ok ? "text-emerald-700" : "text-rose-600",
            )}
          >
            {feedback.text}
          </span>
        )}
      </div>
    </form>
  );
}

export function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  hint,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | number;
  hint?: string;
  inputMode?: "text" | "numeric" | "decimal";
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11.5px] font-medium text-ink-600">{label}</span>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        defaultValue={defaultValue}
        autoComplete="off"
        // 16px min font-size — anything smaller makes iOS Safari zoom the
        // viewport on focus and the layout never fully recovers.
        className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-[16px] text-ink-900 outline-none transition-shadow focus:border-brand-400 focus:shadow-focus"
      />
      {hint && <span className="mt-1 block text-[11px] leading-snug text-ink-400">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11.5px] font-medium text-ink-600">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-[16px] text-ink-900 outline-none focus:border-brand-400 focus:shadow-focus"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
