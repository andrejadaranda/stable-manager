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
import {
  PageHeader,
  Badge,
  EmptyState,
  LinkButton,
  lessonStatusTone,
  lessonStatusLabel,
  type LessonStatus,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/login");
  if (session.role === "client") redirect("/dashboard/my-lessons");

  const s = await getDashboardSummary();

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

  const greetingName = session.userId ? "" : "";   // TODO: pull full_name when available
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
            Labas{greetingName ? `, ${greetingName}` : ""}
          </h1>
          <p className="text-sm text-ink-500 mt-2 capitalize">{today}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LinkButton href="/dashboard/calendar" variant="primary" size="md">
            + Naujas lessons
          </LinkButton>
          <LinkButton href="/dashboard/sessions" variant="secondary" size="md">
            Log a session
          </LinkButton>
        </div>
      </header>

      {/* ── MAIN GRID ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
        {/* LEFT — primary content */}
        <div className="flex flex-col gap-5 min-w-0">
          {/* Today timeline card */}
          <section className="card-elevated p-5 md:p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-navy-900">Šiandienos pamokos</h2>
              <span className="text-[11.5px] text-ink-500">
                {s.todayLessons.length === 0
                  ? "Nieko nesuplanuota"
                  : `${s.todayLessons.length} numatyta · ${s.todayLessons.filter(l => l.status === "completed").length} baigta`}
              </span>
            </div>

            {s.todayLessons.length === 0 ? (
              <p className="text-sm text-ink-500">
                Šiandien nėra lessons. Atidaryk{" "}
                <Link href="/dashboard/calendar" className="text-brand-700 font-medium hover:text-brand-800">
                  kalendorių
                </Link>
                {" "}kad pridėti.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {s.todayLessons.map((l) => (
                  <TimelineRow key={l.id} lesson={l} />
                ))}
              </ul>
            )}
          </section>

          {/* Active horses + Revenue row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ActiveHorsesCard count={s.activeHorses} />
            <RevenueCard
              monthlyRevenue={s.monthlyRevenue}
              monthLabel={s.monthLabel}
              fmtEUR={fmtEUR}
            />
          </div>

          {/* Quick actions — owner only */}
          {s.isOwner && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <QuickAction
                href="/dashboard/horses"
                title="Arkliai"
                body="Workload, dienos limitai, statusas."
              />
              <QuickAction
                href="/dashboard/clients"
                title="Klientai"
                body="Sąrašas, balansai, kontaktai."
              />
              <QuickAction
                href="/dashboard/payments"
                title="Mokėjimai"
                body="Įvesti cash, kortele, ar pavedimu."
              />
            </section>
          )}
        </div>

        {/* RIGHT — KPI rings panel */}
        <aside className="card-elevated p-5 md:p-6 flex flex-col gap-5 lg:sticky lg:top-4 self-start">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-navy-900">Šios savaitės metrikos</h2>
            <span className="text-[11px] text-ink-500">{s.monthLabel}</span>
          </div>

          <KpiRing
            label="Užimtumas"
            value={`${utilizationPct}%`}
            sub={`${s.weekLessonsCount} lessons${completedRatio > 0 ? ` · ${completedRatio}% baigta` : ""}`}
            pct={utilizationPct}
            color="#E04E25"
          />
          <KpiRing
            label="Mokėjimai"
            value={`${collectionPct}%`}
            sub={`${fmtEUR(s.monthlyRevenue)} surinkta`}
            pct={collectionPct}
            color="#1E2A47"
          />
          <KpiRing
            label="Klientų skola"
            value={fmtEUR(s.outstandingBalance)}
            sub={s.outstandingBalance > 0 ? "Negrąžinta" : "Visi sumokėjo"}
            pct={s.outstandingBalance > 0 ? Math.min(100, Math.round((s.outstandingBalance / Math.max(1, s.monthlyRevenue + s.outstandingBalance)) * 100)) : 0}
            color="#B23838"
            inverted
          />
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
        <span className="text-[11px] tracking-[0.04em] uppercase text-ink-500">Aktyvūs arkliai</span>
        <span className="w-7 h-7 rounded-lg bg-brand-50 inline-flex items-center justify-center text-brand-700">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 19c0-3 2-5 5-5h4l3-3 2 1-1 3-2 1v3"/>
            <path d="M5 19h13"/>
          </svg>
        </span>
      </div>
      <div className="font-display text-3xl text-navy-900">{count}</div>
      <p className="text-[12px] text-ink-500">Šiuo metu rotacijoje</p>
      <span className="text-[12px] text-brand-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Žiūrėti →
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
  return (
    <div className="card-navy p-5 md:p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] tracking-[0.04em] uppercase text-navy-100/80">
          Mėnesio pajamos
        </span>
        <span className="text-[11px] text-navy-100/70">{monthLabel}</span>
      </div>
      <div className="font-display text-3xl text-white">{fmtEUR(monthlyRevenue)}</div>
      <p className="text-[12px] text-navy-100/70">Surinkti mokėjimai šį mėnesį</p>
      {/* Mini bars decoration */}
      <div className="mt-2 h-7 flex items-end gap-1.5">
        {[30, 50, 40, 65, 55, 75, 90].map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: `${h}%`,
              background: i === 6 ? "#F4663D" : "#2F406A",
            }}
          />
        ))}
      </div>
    </div>
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
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="card-elevated is-interactive p-4 group">
      <p className="text-sm font-semibold text-navy-900 group-hover:text-brand-700 transition-colors">
        {title}
      </p>
      <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">{body}</p>
      <p className="text-[11.5px] text-brand-700 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        Atidaryti →
      </p>
    </Link>
  );
}
