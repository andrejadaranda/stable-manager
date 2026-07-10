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
import type { ReactNode } from "react";
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

      {/* Day at a glance — three quick numbers + the calendar entry. */}
      <div className="rounded-3xl bg-white border border-ink-100 shadow-soft p-5">
        <div className="grid grid-cols-3 gap-3 pb-4 border-b border-ink-100">
          <Glance value={String(s.todayLessons.length)} label={`Lesson${s.todayLessons.length === 1 ? "" : "s"} today`} />
          {!isPersonal && (
            <Glance value={`€${Math.abs(Number(s.outstandingBalance ?? 0)).toFixed(0)}`} label="To collect" due />
          )}
          <Glance value={String(s.activeHorses ?? 0)} label="Horses in care" />
        </div>
        <Link href="/dashboard/calendar" className="group flex items-center justify-between gap-3 pt-4">
          <span className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 shrink-0 rounded-xl bg-brand-100 text-brand-700 inline-flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 3v3M16 3v3" /></svg>
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold text-ink-900">Open calendar</span>
              <span className="block text-[12.5px] text-ink-500 truncate">Book, check availability, drag to reschedule</span>
            </span>
          </span>
          <span aria-hidden className="text-ink-300 group-hover:translate-x-0.5 transition-transform text-lg">›</span>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2.5">
        <QuickAction href="/dashboard/calendar" label="Book lesson" tone="bg-brand-100 text-brand-700" icon={<path d="M12 5v14M5 12h14" />} />
        <QuickAction href="/dashboard/sessions" label="Log ride" tone="bg-saddle-100 text-saddle-700" icon={<><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>} />
        {isPersonal ? (
          <QuickAction href="/dashboard/welfare" label="Welfare" tone="bg-sky-100 text-sky-700" icon={<path d="M19 14c1.5-1.5 3-3.3 3-5.5A5.5 5.5 0 0 0 12 5 5.5 5.5 0 0 0 2 8.5c0 2.2 1.5 4 3 5.5l7 7Z" />} />
        ) : (
          <QuickAction href="/dashboard/finance/invoices" label="New invoice" tone="bg-sky-100 text-sky-700" icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>} />
        )}
        <QuickAction href="/dashboard/finance" label="More" tone="bg-surface-sunken text-ink-600" icon={<><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>} />
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

          {/* NB: active-horse count and monthly revenue are NOT repeated
              here — they live once in the KPI rings panel ("Horses in
              care" + "Payments · collected"). Kept single-home to avoid
              the dashboard reading twice. */}

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

function Glance({ value, label, due }: { value: string; label: string; due?: boolean }) {
  return (
    <div className="min-w-0 text-center">
      <div className={`font-mono font-semibold text-[24px] tabular-nums leading-none ${due ? "text-alert-700" : "text-ink-900"}`}>{value}</div>
      <div className="text-[11px] text-ink-500 mt-1.5 leading-tight">{label}</div>
    </div>
  );
}

function QuickAction({ href, label, tone, icon }: { href: string; label: string; tone: string; icon: ReactNode }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-2 bg-white border border-ink-100 rounded-2xl shadow-soft py-3.5 active:scale-[0.97] transition-transform">
      <span className={`w-10 h-10 rounded-xl inline-flex items-center justify-center ${tone}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </span>
      <span className="text-[12px] font-semibold text-ink-700 text-center leading-tight">{label}</span>
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

