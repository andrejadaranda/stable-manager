// /dashboard — premium overview home page (Navy + Orange refresh).
//
// Layout (desktop):
//   1. Greeting hero with serif "Hi, {name}"
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
import { syncSubscriptionFromCheckoutSession } from "@/lib/stripe/sync";
import { getDashboardSummary, type DashboardLesson } from "@/services/dashboard";
import { getOwnProfile } from "@/services/account";
import { listMyHorses } from "@/services/myHorses";
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
import { InboxWidget } from "@/components/dashboard/inbox-widget";
import { MetricsPanel } from "@/components/dashboard/metrics-panel";
import { getOnboardingStatus } from "@/services/onboarding";
import { getSmartSuggestions } from "@/services/suggestions";
import { getUpcomingBirthdays } from "@/services/birthdays";
import { listCareRequestsForOwner } from "@/services/careRequests";
import { listLessonRequestsForOwner } from "@/services/lessonRequests";
import { listJoinRequestsForOwner } from "@/services/joinRequests";

export const dynamic = "force-dynamic";

export default async function DashboardHome({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string; welcome?: string }>;
}) {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/login");
  // Clients land on the portal home that matches their shape. A boarder /
  // horse-owner who takes no lessons would hit an empty "My lessons" page,
  // so route them to "My horses" instead. Riders keep lessons as home.
  if (session.role === "client") {
    let dest = "/dashboard/my-lessons";
    try {
      const myHorses = await listMyHorses();
      const ownsHorses = myHorses.some((h) => h.relationship === "owner");
      const ridesHorses = myHorses.some((h) => h.relationship === "rider");
      if (ownsHorses && !ridesHorses) dest = "/dashboard/my-horses";
    } catch {
      /* fall back to lessons home */
    }
    redirect(dest);
  }

  // Belt-and-braces: if Stripe redirected the user back here with a
  // session_id, sync the subscription state DIRECTLY (don't trust the
  // webhook to have arrived yet). Without this, a Personal user who
  // pays via FOUNDER100 + Apple Pay can complete Checkout but get
  // bounced back to /dashboard/personal-checkout because middleware
  // sees the stale 'trialing past' seed row. After sync, status flips
  // to 'active' / 'trialing' with the real subscription row and
  // middleware lets them through on next request.
  const params = await searchParams;
  if (params?.session_id && session.stableId) {
    try {
      await syncSubscriptionFromCheckoutSession(params.session_id, session.stableId);
      // Redirect to clean URL without session_id so a refresh doesn't re-sync.
      redirect("/dashboard" + (params.welcome ? `?welcome=${params.welcome}` : ""));
    } catch (err) {
      // Don't block dashboard if sync fails — log and continue. Middleware
      // may still redirect them; the surfaced message in billing UI will
      // explain. (Webhook should eventually catch up.)
      console.error("[dashboard] post-checkout sync failed:", err);
    }
  }

  // Personal (B2C) accounts have no clients, no inbox, no payments collected,
  // no team — they only manage THEIR OWN horses. Anything business-only on
  // this dashboard branches on this flag below.
  const isPersonal = session.accountType === "personal";

  const [s, profile, onboarding, suggestions, birthdays, openCareRequests, openLessonRequests, openJoinRequests] = await Promise.all([
    getDashboardSummary(),
    getOwnProfile().catch(() => null),
    getOnboardingStatus().catch(() => null),
    getSmartSuggestions().catch(() => []),
    getUpcomingBirthdays().catch(() => []),
    isPersonal ? Promise.resolve([]) : listCareRequestsForOwner({ status: "open", limit: 25 }).catch(() => []),
    isPersonal ? Promise.resolve([]) : listLessonRequestsForOwner({ status: "open", limit: 25 }).catch(() => []),
    isPersonal ? Promise.resolve([]) : listJoinRequestsForOwner({ status: "open", limit: 25 }).catch(() => []),
  ]);

  const firstName = (profile?.full_name ?? "").split(" ")[0] ?? "";

  const fmtEUR = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  const greetingName = firstName;
  // Render the greeting date in Europe/Vilnius so a server in UTC (Vercel runs
  // most edges in UTC) doesn't show "yesterday" between 21:00 UTC and 00:00
  // UTC, when Vilnius has already rolled past midnight. Locked to en-GB for
  // consistency — month and weekday names stay English regardless of the
  // viewer's browser locale.
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Vilnius",
  }).format(new Date());

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

        {isPersonal ? (
          <Link
            href="/dashboard/horses"
            className="
              rounded-2xl bg-white shadow-soft hover:shadow-lift transition-shadow
              px-4 py-4 flex flex-col justify-center gap-1
            "
          >
            <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-brand-700">
              + Add horse
            </span>
            <span className="text-[12.5px] text-ink-600">
              Up to {isPersonal ? "2 horses (Mini) / 5 horses (Plus)" : "your plan limit"}.
            </span>
          </Link>
        ) : (
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
        )}

        <Link
          href="/dashboard/sessions"
          className="
            rounded-2xl bg-white shadow-soft hover:shadow-lift transition-shadow
            px-4 py-4 flex flex-col justify-center gap-1
          "
        >
          <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-navy-700">
            Log a {isPersonal ? "ride" : "session"}
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

          {/* Active horses + Revenue row.
              Personal accounts: hide the Revenue card (no client billing). */}
          <div className={`grid grid-cols-1 ${isPersonal ? "" : "md:grid-cols-2"} gap-5`}>
            <ActiveHorsesCard count={s.activeHorses} />
            {!isPersonal && (
              <RevenueCard
                monthlyRevenue={s.monthlyRevenue}
                monthLabel={s.monthLabel}
                fmtEUR={fmtEUR}
              />
            )}
          </div>

          {/* Combined inbox — Join + Lesson + Care requests grouped.
              Personal accounts: there's no inbox concept (no clients
              requesting things), so skip rendering entirely. */}
          {!isPersonal && (
            <InboxWidget
              joinOpen={openJoinRequests}
              lessonOpen={openLessonRequests}
              careOpen={openCareRequests}
            />
          )}

          {/* Birthdays — emotional micro-widget, moved to the bottom.
              Auto-hides when no horse/client birthday in next 14 days. */}
          <BirthdaysWidget items={birthdays} />

          {/* Quick actions — owner only, business stables. Personal
              accounts get a single-card prompt at the top instead. */}
          {s.isOwner && !isPersonal && (
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
        <MetricsPanel
          weekLessonsCount={s.weekLessonsCount}
          weekLessonsCompleted={s.weekLessonsCompleted}
          monthLessonsCount={s.monthLessonsCount}
          monthLessonsCompleted={s.monthLessonsCompleted}
          activeHorses={s.activeHorses}
          outstandingBalance={s.outstandingBalance}
          weekRevenue={s.weekRevenue}
          monthlyRevenue={s.monthlyRevenue}
          monthLabel={s.monthLabel}
          isOwner={s.isOwner}
          isPersonal={isPersonal}
        />
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


function TimelineRow({ lesson }: { lesson: DashboardLesson }) {
  const start = new Date(lesson.starts_at);
  const end = new Date(lesson.ends_at);
  // Explicit Europe/Vilnius — this is a SERVER component, so the runtime
  // default (UTC on Vercel) was rendering lessons 3h early (12:00 → 09:00).
  const time = start.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Vilnius",
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
