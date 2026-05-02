// /dashboard — premium overview home page (Navy + Orange refresh).
//
// Layout (desktop):
//   1. Greeting hero with serif "Labas, {name}"
//   2. KPI ring panel (utilization / collection / horse health) — right column
//   3. Today's lessons card — left, top
//   4. Active horses snapshot + Revenue dark hero card — left, bottom row
//   5. Quick actions row at bottom (owner only)
//
// Mobile: single column stack, KPI rings collapse below content.
//
// Clients are still routed to /dashboard/my-lessons (their portal home).

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDashboardSummary, type DashboardLesson } from "@/services/dashboard";
import { getOwnProfile } from "@/services/account";
import {
  PageHeader,
  Badge,
  EmptyState,
  LinkButton,
  lessonStatusTone,
  lessonStatusLabel,
  type LessonStatus,
} from "@/components/ui";
import { RemindersBlock } from "@/components/reminders/reminders-block";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { SmartSuggestions } from "@/components/dashboard/smart-suggestions";
import { BirthdaysWidget } from "@/components/dashboard/birthdays-widget";
import { getOnboardingStatus } from "@/services/onboarding";
import { getSmartSuggestions } from "@/services/suggestions";
import { getUpcomingBirthdays } from "@/services/birthdays";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/login");
  if (session.role === "client") redirect("/dashboard/my-lessons");

  const [s, profile, onboarding, suggestions, birthdays] = await Promise.all([
    getDashboardSummary(),
    getOwnProfile().catch(() => null),
    getOnboardingStatus().catch(() => null),
    getSmartSuggestions().catch(() => []),
    getUpcomingBirthdays().catch(() => []),
  ]);

  const firstName = (profile?.full_name ?? "").split(" ")[0] ?? "";

  const fmtEUR = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  const completedRatio =
    s.weekLessonsCount > 0
      ? Math.round((s.weekLessonsCompleted / s.weekLessonsCount) * 100)
      : 0;

  const utilizationPct = Math.min(
    100,
    s.weekLessonsCount > 0 && s.activeHorses > 0
      ? Math.round((s.weekLessonsCount / (s.activeHorses * 6)) * 100)
      : 0,
  );

  const collectionPct =
    s.monthlyRevenue + s.outstandingBalance > 0
      ? Math.round(
          (s.monthlyRevenue / (s.monthlyRevenue + s.outstandingBalance)) * 100,
        )
      : 100;

  const greetingName = firstName;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ── HERO ──────────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl md:text-4xl text-navy-700 leading-none">
            Hi{greetingName ? `, ${greetingName}` : ""}
          </h1>
          <p className="text-sm text-ink-500 mt-2 capitalize">{today}</p>
        </div>
      </header>

      {/* Primary action band — Calendar lives front-and-centre because
          90% of trainer interactions start here. The big "Open
          Calendar" tile leads; smaller links sit beside it for the
          secondary flows. Sticks to the top of the dashboard so it's
          the first thing visible after Hi greeting. */}
      <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr] gap-3">
        <Link
          href="/dashboard/calendar"
          className="
            group rounded-2xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800
            text-white shadow-lift transition-colors
            px-5 py-4 flex items-center gap-4
          "
        >
          <span
            aria-hidden
            className="w-12 h-12 shrink-0 rounded-xl bg-white/15 inline-flex items-center justify-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
              <path d="M3 9h18M8 3v3M16 3v3" />
            </svg>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-xl leading-none">Open calendar</span>
            <span className="block text-[12.5px] text-white/85 mt-1">
              Book a lesson, check availability, drag to reschedule
            </span>
          </span>
          <span aria-hidden className="text-white/80 group-hover:translate-x-0.5 transition-transform">
            →
          </span>
        </Link>

        <Link
          href="/dashboard/calendar"
          className="
            rounded-2xl bg-white shadow-soft hover:shadow-lift transition-shadow
            px-4 py-4 flex flex-col justify-center gap-1
          "
        >
          <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-brand-700">
            + New lesson
          </span>
          <span className="text-[12.5px] text-ink-600">
            Click any time slot to book.
          </span>
        </Link>

        <Link
          href="/dashboard/sessions"
          className="
            rounded-2xl bg-white shadow-soft hover:shadow-lift transition-shadow
            px-4 py-4 flex flex-col justify-center gap-1
          "
        >
          <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-navy-700">
            Log a session
          </span>
          <span className="text-[12.5px] text-ink-600">
            Record a ride that just happened.
          </span>
        </Link>
      </div>

      {/* ── MAIN GRID ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
        {/* LEFT — primary content */}
        <div className="flex flex-col gap-5 min-w-0">
          {/* Onboarding — guides a fresh stable to first lesson.
              Auto-hides once everything is set up. */}
          <OnboardingChecklist status={onboarding} />

          {/* Smart suggestions — proactive welfare / health / money
              signals. Highest information value, top of column. */}
          <SmartSuggestions items={suggestions} />

          {/* Today's lessons — moved up (post-feedback, was below
              reminders + birthdays). The most-used "what now" surface. */}
          <section className="card-elevated p-5 md:p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-navy-900">Today's lessons</h2>
              <span className="text-[11.5px] text-ink-500">
                {s.todayLessons.length === 0
                  ? "Nothing scheduled"
                  : `${s.todayLessons.length} scheduled · ${s.todayLessons.filter(l => l.status === "completed").length} completed`}
              </span>
            </div>

            {s.todayLessons.length === 0 ? (
              <p className="text-sm text-ink-500">
                No lessons today. Open the{" "}
                <Link href="/dashboard/calendar" className="text-brand-700 font-medium hover:text-brand-800">
                  calendar
                </Link>
                {" "}to add one.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {s.todayLessons.map((l) => (
                  <TimelineRow key={l.id} lesson={l} />
                ))}
              </ul>
            )}
          </section>

          {/* Reminders */}
          <RemindersBlock />

          {/* Active horses + Revenue row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ActiveHorsesCard count={s.activeHorses} />
            <RevenueCard
              monthlyRevenue={s.monthlyRevenue}
              monthLabel={s.monthLabel}
              fmtEUR={fmtEUR}
            />
          </div>

          {/* Birthdays — emotional micro-widget, moved to the bottom.
              Auto-hides when no horse/client birthday in next 14 days. */}
          <BirthdaysWidget items={birthdays} />

          {/* Quick actions — owner only */}
          {s.isOwner && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <QuickAction
                href="/dashboard/horses"
                title="Horses"
                body="Workload, daily limits, status."
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 19c0-3 2-5 5-5h4l3-3 2 1-1 3-2 1v3"/>
                    <path d="M5 19h13"/>
                    <path d="M9 8l-2-2 2-2 2 2"/>
                  </svg>
                }
              />
              <QuickAction
                href="/dashboard/clients"
                title="Clients"
                body="Roster, balances, contacts."
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="8" r="3"/>
                    <path d="M3 20c0-3 3-5 6-5s6 2 6 5"/>
                    <circle cx="17" cy="9" r="2.5"/>
                    <path d="M21 19c0-2-1.5-4-4-4"/>
                  </svg>
                }
              />
              <QuickAction
                href="/dashboard/payments"
                title="Payments"
                body="Log cash, card, or transfer payments."
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="6" width="18" height="12" rx="2"/>
                    <circle cx="12" cy="12" r="2.5"/>
                    <path d="M7 10v.01M17 14v.01"/>
                  </svg>
                }
              />
            </section>
          )}
        </div>

        {/* RIGHT — KPI rings panel */}
        <aside className="card-elevated p-5 md:p-6 flex flex-col gap-5 lg:sticky lg:top-4 self-start">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-navy-900">This week's metrics</h2>
            <span className="text-[11px] text-ink-500">{s.monthLabel}</span>
          </div>

          {s.weekLessonsCount === 0 && s.monthlyRevenue === 0 && s.outstandingBalance === 0 ? (
            <EmptyMetrics />
          ) : (
            <>
              <KpiRing
                label="Utilization"
                value={`${utilizationPct}%`}
                sub={`${s.weekLessonsCount} lessons${completedRatio > 0 ? ` · ${completedRatio}% completed` : ""}`}
                pct={utilizationPct}
                color="#E04E25"
              />
              <KpiRing
                label="Payments"
                value={`${collectionPct}%`}
                sub={`${fmtEUR(s.monthlyRevenue)} collected`}
                pct={collectionPct}
                color="#1E2A47"
              />
              <KpiRing
                label="Client balance"
                value={fmtEUR(s.outstandingBalance)}
                sub={s.outstandingBalance > 0 ? "Outstanding" : "All paid up"}
                pct={s.outstandingBalance > 0 ? Math.min(100, Math.round((s.outstandingBalance / Math.max(1, s.monthlyRevenue + s.outstandingBalance)) * 100)) : 0}
                color="#B23838"
                inverted
              />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---------- Components ----------------------------------------

function ActiveHorsesCard({ count }: { count: number }) {
  return (
    <Link
      href="/dashboard/horses"
      className="card-elevated is-interactive p-5 md:p-6 group flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] tracking-[0.04em] uppercase text-ink-500">Active horses</span>
        <span className="w-7 h-7 rounded-lg bg-brand-50 inline-flex items-center justify-center text-brand-700">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 19c0-3 2-5 5-5h4l3-3 2 1-1 3-2 1v3"/>
            <path d="M5 19h13"/>
          </svg>
        </span>
      </div>
      <div className="font-display text-3xl text-navy-900">{count}</div>
      <p className="text-[12px] text-ink-500">Currently in rotation</p>
      <span className="text-[12px] text-brand-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        View →
      </span>
    </Link>
  );
}

function RevenueCard({
  monthlyRevenue,
  monthLabel,
  fmtEUR,
}: {
  monthlyRevenue: number;
  monthLabel: string;
  fmtEUR: (n: number) => string;
}) {
  // The whole card is now a link into the finance dashboard, where
  // the owner gets a per-source / per-horse breakdown. Keep the
  // visual identical so dashboards reading recognise the card.
  return (
    <Link
      href="/dashboard/finance"
      className="card-navy p-5 md:p-6 flex flex-col gap-3 group hover:shadow-lift transition-shadow"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] tracking-[0.04em] uppercase text-white/80">
          Monthly revenue
        </span>
        <span className="text-[11px] text-white/70 inline-flex items-center gap-1">
          {monthLabel}
          <span aria-hidden className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
        </span>
      </div>
      <div className="font-display text-3xl text-white">{fmtEUR(monthlyRevenue)}</div>
      <p className="text-[12px] text-white/70">
        Collected payments this month · tap for breakdown
      </p>
    </Link>
  );
}

function KpiRing({
  label,
  value,
  sub,
  pct,
  color,
  inverted,
}: {
  label: string;
  value: string;
  sub: string;
  pct: number;
  color: string;
  inverted?: boolean;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="flex items-center gap-4">
      <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#F1EAE0" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 32 32)"
        />
        <text
          x="32"
          y="35"
          textAnchor="middle"
          fontSize="11"
          fontWeight="500"
          fill="#1E2A47"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {value.length > 6 ? value.slice(0, 6) : value}
        </text>
      </svg>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-navy-900">{label}</div>
        <div className="text-[11px] text-ink-500 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function EmptyMetrics() {
  return (
    <div className="flex flex-col items-center text-center py-4 px-2">
      <span
        className="w-12 h-12 rounded-2xl bg-brand-50 inline-flex items-center justify-center mb-3"
        aria-hidden
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E04E25" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      </span>
      <p className="text-[13px] font-medium text-navy-900">Metrics will appear as you use the app</p>
      <p className="text-[11.5px] text-ink-500 mt-1.5 leading-relaxed">
        Add your first lesson and log your first session — utilization, payments, and outstanding balances will start filling in immediately.
      </p>
      <Link
        href="/dashboard/calendar"
        className="mt-3 text-[12px] font-medium text-brand-700 hover:text-brand-800"
      >
        + New lesson →
      </Link>
    </div>
  );
}

function TimelineRow({ lesson }: { lesson: DashboardLesson }) {
  const start = new Date(lesson.starts_at);
  const end = new Date(lesson.ends_at);
  const time = start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dur = Math.round((end.getTime() - start.getTime()) / 60000);

  const accent =
    lesson.status === "completed"
      ? "#94A3B8"
      : lesson.status === "cancelled" || lesson.status === "no_show"
        ? "#C4B9AC"
        : "#F4663D";

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 bg-surface-muted/40 rounded-xl hover:bg-surface-muted/70 transition-colors">
      <span className="w-1 h-9 rounded-sm shrink-0" style={{ background: accent }} />
      <div className="w-14 shrink-0 text-sm font-semibold text-navy-900 tabular-nums">{time}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-navy-900 truncate">
          {lesson.horse?.name ?? "—"}
          <span className="text-ink-400 font-normal"> · </span>
          <span className="text-ink-700 font-normal">{lesson.client?.full_name ?? "—"}</span>
        </p>
        <p className="text-[11.5px] text-ink-500 mt-0.5">
          {lesson.trainer?.full_name ?? "Unassigned"} · {dur} min
        </p>
      </div>
      <Badge tone={lessonStatusTone(lesson.status as LessonStatus)} dot>
        {lessonStatusLabel(lesson.status as LessonStatus)}
      </Badge>
    </li>
  );
}

function QuickAction({
  href,
  title,
  body,
  icon,
}: {
  href: string;
  title: string;
  body: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link href={href} className="card-elevated is-interactive p-4 group flex items-start gap-3">
      {icon && (
        <span className="w-9 h-9 shrink-0 rounded-xl bg-brand-50 text-brand-700 inline-flex items-center justify-center group-hover:bg-brand-100 transition-colors">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy-900 group-hover:text-brand-700 transition-colors">
          {title}
        </p>
        <p className="text-[12px] text-ink-500 mt-0.5 leading-relaxed">{body}</p>
      </div>
      <span className="shrink-0 text-ink-300 group-hover:text-brand-700 transition-colors mt-0.5" aria-hidden>
        →
      </span>
    </Link>
  );
}
