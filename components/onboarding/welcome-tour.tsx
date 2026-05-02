"use client";

// First-time welcome tour. Full-screen modal with 5 illustrated steps
// that explain what Hoofbeat is and what to do first. Owner gets a
// stable-setup-flavoured tour; clients see the rider-portal tour.
//
// On finish or skip → server action stamps profiles.onboarded_at,
// so the tour never auto-shows again. Replay later from the
// account menu (writes a fresh timestamp, idempotent).

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Role } from "@/lib/auth/session";
import { markOnboardedAction } from "@/app/dashboard/onboarded/actions";

type Step = {
  title:    string;
  body:     string;
  cta?:     { label: string; href: string };
  visual:   "schedule" | "horses" | "money" | "team" | "celebrate" | "client";
};

const OWNER_STEPS: Step[] = [
  {
    title:  "Welcome to Hoofbeat.",
    body:   "Your stable's calendar, payments, and horse welfare on one screen. Built for European yards with 15–40 horses. Let's get you running in five short steps.",
    visual: "celebrate",
  },
  {
    title:  "Add your first horse",
    body:   "Every lesson, session, and boarding charge ties back to a horse. Add at least one to unlock the calendar. You can edit limits and notes any time.",
    cta:    { label: "Open Horses", href: "/dashboard/horses?new=1" },
    visual: "horses",
  },
  {
    title:  "Add your first client",
    body:   "Clients are the riders or horse owners you book lessons for. Phone is enough — emails are optional.",
    cta:    { label: "Open Clients", href: "/dashboard/clients?new=1" },
    visual: "team",
  },
  {
    title:  "Book a lesson",
    body:   "Open the calendar, click an empty time slot. Pick the horse, client, trainer, and price. Use Recurring to repeat the booking weekly.",
    cta:    { label: "Open Calendar", href: "/dashboard/calendar" },
    visual: "schedule",
  },
  {
    title:  "Track payments",
    body:   "When a client pays — cash, card, transfer — log it on the Payments page. The balance on every client profile updates automatically. Dashboard shows monthly revenue at a glance.",
    cta:    { label: "Open Payments", href: "/dashboard/payments" },
    visual: "money",
  },
];

const CLIENT_STEPS: Step[] = [
  {
    title:  "Welcome to your stable's portal.",
    body:   "See upcoming lessons, payment history, and session logs your trainer adds. All in one place, on any device.",
    visual: "celebrate",
  },
  {
    title:  "Your lessons",
    body:   "My Lessons shows the week's scheduled rides. Tap a lesson to see the horse and trainer assigned.",
    cta:    { label: "Open My Lessons", href: "/dashboard/my-lessons" },
    visual: "schedule",
  },
  {
    title:  "Your payments",
    body:   "My Payments shows what you've paid and your current balance. A negative balance means you owe; positive means credit on file.",
    cta:    { label: "Open My Payments", href: "/dashboard/my-payments" },
    visual: "money",
  },
  {
    title:  "Your rides",
    body:   "My Rides logs every session your trainer records — what type, how long, how it went. A timeline of your progress.",
    cta:    { label: "Open My Rides", href: "/dashboard/my-sessions" },
    visual: "client",
  },
];

export function WelcomeTour({ role }: { role: Role }) {
  const steps = role === "client" ? CLIENT_STEPS : OWNER_STEPS;
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  const finish = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await markOnboardedAction();
      setHidden(true);
    } catch {
      // If the network blip prevents recording, hide locally so user
      // isn't blocked. Will replay next session — minor inconvenience.
      setHidden(true);
    }
  }, [busy]);

  // Esc to skip
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (hidden) return;
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" && i < steps.length - 1) setI(i + 1);
      if (e.key === "ArrowLeft"  && i > 0)                setI(i - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden, finish, i, steps.length]);

  // Lock body scroll while open
  useEffect(() => {
    if (hidden) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [hidden]);

  if (hidden) return null;

  const step = steps[i];
  const isLast = i === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-navy-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="bg-white rounded-3xl shadow-lift max-w-lg w-full overflow-hidden flex flex-col">
        {/* Visual hero */}
        <div className="relative h-44 bg-gradient-to-br from-brand-50 to-warm-100 flex items-center justify-center overflow-hidden">
          <Visual kind={step.visual} />
          <button
            type="button"
            onClick={finish}
            aria-label="Skip tour"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-ink-600 hover:text-ink-900 flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
          {/* Step pips */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {steps.map((_, idx) => (
              <span
                key={idx}
                aria-hidden
                className={`h-1.5 rounded-full transition-all ${
                  idx === i ? "w-6 bg-brand-600" : "w-1.5 bg-ink-300"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pt-6 pb-2 flex-1">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-brand-700 mb-2">
            Step {i + 1} of {steps.length}
          </p>
          <h2
            id="welcome-title"
            className="font-display text-2xl text-navy-900 leading-tight"
          >
            {step.title}
          </h2>
          <p className="text-sm text-ink-700 mt-3 leading-relaxed">
            {step.body}
          </p>
          {step.cta && (
            <Link
              href={step.cta.href}
              onClick={finish}
              className="
                inline-flex items-center gap-1.5 mt-4
                text-[13px] font-medium text-brand-700 hover:text-brand-800
              "
            >
              {step.cta.label} →
            </Link>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between border-t border-ink-100 bg-surface/40">
          <button
            type="button"
            onClick={finish}
            className="text-[12.5px] text-ink-500 hover:text-ink-900"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI(i - 1)}
                className="h-9 px-4 rounded-xl text-sm font-medium text-ink-700 hover:bg-ink-100/60"
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={finish}
                disabled={busy}
                className="
                  h-9 px-5 rounded-xl text-sm font-medium
                  bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
                  disabled:opacity-60 transition-colors
                "
              >
                {busy ? "…" : "Get started"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setI(i + 1)}
                className="
                  h-9 px-5 rounded-xl text-sm font-medium
                  bg-navy-900 text-white shadow-sm hover:bg-navy-800
                  transition-colors
                "
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Quiet, abstract illustrations — keeps the brand feel grown-up.
// Each kind paints an SVG mark in brand colors.
function Visual({ kind }: { kind: Step["visual"] }) {
  const common = {
    width:  140,
    height: 140,
    viewBox: "0 0 140 140",
    fill: "none" as const,
  };
  switch (kind) {
    case "celebrate":
      return (
        <svg {...common} aria-hidden>
          <circle cx="70" cy="70" r="60" fill="#FBE6D8" />
          <circle cx="70" cy="70" r="38" fill="#F4663D" />
          <path d="M55 70l10 10 22-22" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "horses":
      return (
        <svg {...common} aria-hidden>
          <circle cx="70" cy="70" r="60" fill="#F1EAE0" />
          <path d="M40 96c0-15 10-25 25-25h18l12-12 8 4-4 12-8 4v12" stroke="#1E2A47" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M40 96h52" stroke="#1E2A47" strokeWidth="4" strokeLinecap="round" />
          <circle cx="93" cy="61" r="2.5" fill="#1E2A47" />
        </svg>
      );
    case "team":
      return (
        <svg {...common} aria-hidden>
          <circle cx="70" cy="70" r="60" fill="#E5E9F2" />
          <circle cx="56" cy="56" r="12" fill="#1E2A47" />
          <path d="M34 102c0-12 10-20 22-20s22 8 22 20" stroke="#1E2A47" strokeWidth="4" strokeLinecap="round" />
          <circle cx="92" cy="60" r="9" fill="#F4663D" />
          <path d="M104 100c0-9-6-16-12-16" stroke="#F4663D" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case "schedule":
      return (
        <svg {...common} aria-hidden>
          <rect x="20" y="30" width="100" height="84" rx="10" fill="#FFF" stroke="#1E2A47" strokeWidth="3" />
          <path d="M20 50h100M40 24v14M100 24v14" stroke="#1E2A47" strokeWidth="3" strokeLinecap="round" />
          <rect x="36" y="62" width="28" height="14" rx="3" fill="#F4663D" />
          <rect x="74" y="80" width="34" height="14" rx="3" fill="#1E2A47" />
        </svg>
      );
    case "money":
      return (
        <svg {...common} aria-hidden>
          <circle cx="70" cy="70" r="60" fill="#E9F4EA" />
          <rect x="34" y="46" width="72" height="48" rx="6" fill="#FFF" stroke="#1E2A47" strokeWidth="3" />
          <circle cx="70" cy="70" r="11" fill="none" stroke="#1E7A4A" strokeWidth="3" />
          <path d="M70 64v12M64 70h12" stroke="#1E7A4A" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "client":
      return (
        <svg {...common} aria-hidden>
          <circle cx="70" cy="70" r="60" fill="#FDF1E8" />
          <circle cx="70" cy="56" r="14" fill="#F4663D" />
          <path d="M40 110c0-17 13-30 30-30s30 13 30 30" stroke="#F4663D" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
  }
}
