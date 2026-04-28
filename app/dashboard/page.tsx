import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDashboardSummary, type DashboardLesson } from "@/services/dashboard";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import {
  StatCard,
  PageHeader,
  Card,
  CardHeader,
  Badge,
  EmptyState,
  LinkButton,
  SectionTitle,
  lessonStatusTone,
  lessonStatusLabel,
  type LessonStatus,
} from "@/components/ui";

/**
 * Owner / employee home. Replaces the legacy redirect with a real
 * overview: today, this week, active rosters, money in / money out.
 *
 * Clients still skip this — they go to their portal.
 */
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

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Overview"
        subtitle={`Quick look at what's happening today and this week.`}
        actions={
          <LinkButton href="/dashboard/calendar" variant="primary" size="md">
            Open calendar
          </LinkButton>
        }
      />

      {/* ── KPI grid ───────────────────────────────────────────────── */}
      <section>
        <SectionTitle>Today &amp; this week</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard
            label="Today"
            value={s.todayLessons.length}
            hint={
              s.todayLessons.length === 0
                ? "No lessons scheduled"
                : `${s.todayLessons.filter(l => l.status === "scheduled").length} upcoming`
            }
            tone="brand"
          />
          <StatCard
            label="This week"
            value={s.weekLessonsCount}
            hint={
              s.weekLessonsCount === 0
                ? "Nothing on the books yet"
                : `${completedRatio}% completed`
            }
            tone="info"
          />
          <StatCard
            label="Active horses"
            value={s.activeHorses}
            hint="In rotation right now"
            tone="success"
          />
          <StatCard
            label="Active clients"
            value={s.activeClients}
            hint="On your roster"
            tone="neutral"
          />
        </div>
      </section>

      {/* ── Money grid ─────────────────────────────────────────────── */}
      <section>
        <SectionTitle hint={s.monthLabel}>Money this month</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Revenue"
            value={fmtEUR(s.monthlyRevenue)}
            hint="Payments received this month"
            tone="success"
          />
          {s.isOwner && (
            <StatCard
              label="Expenses"
              value={fmtEUR(s.monthlyExpenses ?? 0)}
              hint="Recorded expenses this month"
              tone="warning"
            />
          )}
          <StatCard
            label="Outstanding"
            value={fmtEUR(s.outstandingBalance)}
            hint={
              s.outstandingBalance > 0
                ? "Total owed by clients"
                : "All clients are square"
            }
            tone={s.outstandingBalance > 0 ? "danger" : "neutral"}
          />
        </div>
      </section>

      {/* ── Horse activity heatmap (last 7 days) ───────────────────── */}
      <section>
        <SectionTitle
          action={
            <Link
              href="/dashboard/sessions"
              className="text-[12px] font-medium text-brand-700 hover:text-brand-800"
            >
              Log a session →
            </Link>
          }
        >
          Horse activity
        </SectionTitle>
        <ActivityHeatmap />
      </section>

      {/* ── Today timeline ─────────────────────────────────────────── */}
      <section>
        <SectionTitle
          hint={new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          action={
            <Link
              href="/dashboard/calendar"
              className="text-[12px] font-medium text-brand-700 hover:text-brand-800"
            >
              View full calendar →
            </Link>
          }
        >
          Today
        </SectionTitle>

        {s.todayLessons.length === 0 ? (
          <EmptyState
            title="Nothing on the schedule today"
            body="Your calendar is clear. Plan tomorrow, or check the week ahead."
            primary={{ label: "Open calendar", href: "/dashboard/calendar" }}
          />
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-ink-100">
              {s.todayLessons.map((l) => (
                <TimelineRow key={l.id} lesson={l} />
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* ── Quick actions ─────────────────────────────────────────── */}
      {s.isOwner && (
        <section>
          <SectionTitle>Quick actions</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <QuickAction
              href="/dashboard/horses"
              title="Manage horses"
              body="Workload, daily limits, status."
            />
            <QuickAction
              href="/dashboard/clients"
              title="Manage clients"
              body="Roster, balances, contact info."
            />
            <QuickAction
              href="/dashboard/payments"
              title="Record a payment"
              body="Log cash, card, or transfer."
            />
          </div>
        </section>
      )}
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

  return (
    <li className="px-5 py-4 flex items-center gap-4 hover:bg-surface-muted/40 transition-colors">
      <div className="w-16 shrink-0 text-sm font-semibold text-ink-900 tabular-nums">
        {time}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900 truncate">
          {lesson.horse?.name ?? "—"}
          <span className="text-ink-400 font-normal"> · </span>
          <span className="text-ink-700 font-normal">
            {lesson.client?.full_name ?? "—"}
          </span>
        </p>
        <p className="text-[12px] text-ink-500 mt-0.5">
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
    <Link
      href={href}
      className="card-elevated is-interactive p-5 group"
    >
      <p className="text-sm font-semibold text-ink-900 group-hover:text-brand-700 transition-colors">
        {title}
      </p>
      <p className="text-xs text-ink-500 mt-1 leading-relaxed">{body}</p>
      <p className="text-[12px] text-brand-700 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        Open →
      </p>
    </Link>
  );
}
