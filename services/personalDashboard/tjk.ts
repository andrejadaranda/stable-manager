// TJK operations: who to call, what's booked, what's waiting on her.
//
// All reads go through the caller's own Supabase session, so RLS scopes
// everything to her stable automatically. The explicit stable_id filters
// below are belt-and-braces, not the security boundary.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requirePersonalContext,
  getStableTimeZone,
  safe,
  num,
} from "@/services/personalDashboard/common";
import {
  buildReengagementList,
  localDateKey,
  type ClientRecency,
  type ReengagementRow,
} from "@/services/personalDashboard/core.pure";

export type UpcomingLesson = {
  id: string;
  startsAt: string;
  endsAt: string;
  clientName: string | null;
  horseName: string | null;
  price: number;
  status: string;
  notes: string | null;
};

export type PendingRequest = {
  id: string;
  requesterName: string | null;
  requestedStart: string;
  durationMin: number;
  notes: string | null;
  createdAt: string;
};

export type OpenTodo = {
  id: string;
  body: string;
  dueAt: string | null;
  overdue: boolean;
};

// -------------------------------------------------------------------
// Re-engagement — the "jei nejojo 2 sav jau kviesti" list
// -------------------------------------------------------------------

/**
 * Clients who have gone quiet, ordered by how quiet.
 *
 * Reads the dashboard_client_last_ride view (migration 110). Clients she
 * has already dismissed today are filtered out — see
 * dashboard_dismissals and dismissReengagement() below.
 */
export async function getReengagementList(now = new Date()): Promise<ReengagementRow[]> {
  return safe(
    async () => {
      const ctx = await requirePersonalContext();
      const tz = await getStableTimeZone();
      const supabase = createSupabaseServerClient();

      const [{ data: rows }, { data: dismissals }] = await Promise.all([
        supabase
          .from("dashboard_client_last_ride")
          .select(
            "client_id, full_name, email, phone, last_ride_at, lessons_completed, next_ride_at",
          )
          .eq("stable_id", ctx.stableId)
          .eq("active", true),
        supabase
          .from("dashboard_dismissals")
          .select("ref_id, snooze_until")
          .eq("auth_user_id", ctx.authUserId)
          .eq("kind", "reengagement"),
      ]);

      const todayKey = localDateKey(now, tz);
      // A dismissal with no snooze date is "handled, don't show again".
      // With one, it comes back the morning after it expires.
      const dismissed = new Set(
        (dismissals ?? [])
          .filter((d) => !d.snooze_until || String(d.snooze_until) > todayKey)
          .map((d) => String(d.ref_id)),
      );

      const clients: ClientRecency[] = (rows ?? []).map((r) => ({
        clientId: String(r.client_id),
        fullName: String(r.full_name ?? ""),
        phone: r.phone ?? null,
        email: r.email ?? null,
        lastRideAt: r.last_ride_at ?? null,
        lessonsCompleted: num(r.lessons_completed),
        nextRideAt: r.next_ride_at ?? null,
      }));

      return buildReengagementList(clients, now, tz, dismissed);
    },
    [],
    "getReengagementList",
  );
}

// -------------------------------------------------------------------
// Schedule
// -------------------------------------------------------------------

/** Lessons still to come, soonest first. */
export async function getUpcomingLessons(limit = 12): Promise<UpcomingLesson[]> {
  return safe(
    async () => {
      const ctx = await requirePersonalContext();
      const supabase = createSupabaseServerClient();

      const { data } = await supabase
        .from("lessons")
        .select(
          "id, starts_at, ends_at, price, status, notes, client:clients(full_name), horse:horses(name)",
        )
        .eq("stable_id", ctx.stableId)
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(limit);

      return (data ?? []).map(mapLesson);
    },
    [],
    "getUpcomingLessons",
  );
}

/** Everything on today's calendar, including what has already happened. */
export async function getTodayLessons(now = new Date()): Promise<UpcomingLesson[]> {
  return safe(
    async () => {
      const ctx = await requirePersonalContext();
      const tz = await getStableTimeZone();
      const supabase = createSupabaseServerClient();

      // Day bounds built from the *local* calendar date, then widened by
      // an hour on each side and re-filtered in JS. Postgres compares in
      // UTC and the stable's offset shifts with DST; the widen-then-filter
      // approach is correct in every offset without a tz library.
      const key = localDateKey(now, tz);
      const from = new Date(`${key}T00:00:00Z`);
      from.setUTCHours(from.getUTCHours() - 14);
      const to = new Date(`${key}T00:00:00Z`);
      to.setUTCHours(to.getUTCHours() + 38);

      const { data } = await supabase
        .from("lessons")
        .select(
          "id, starts_at, ends_at, price, status, notes, client:clients(full_name), horse:horses(name)",
        )
        .eq("stable_id", ctx.stableId)
        .neq("status", "cancelled")
        .gte("starts_at", from.toISOString())
        .lt("starts_at", to.toISOString())
        .order("starts_at", { ascending: true });

      return (data ?? [])
        .map(mapLesson)
        .filter((l) => localDateKey(l.startsAt, tz) === key);
    },
    [],
    "getTodayLessons",
  );
}

// Supabase serialises a 1:1 embed as either an object or a 1-element
// array depending on how it inferred the relationship. The existing
// codebase unwraps this defensively (see lib/auth/session.ts) — same here.
function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function mapLesson(r: Record<string, unknown>): UpcomingLesson {
  const client = firstOf(r.client as { full_name?: string } | { full_name?: string }[]);
  const horse = firstOf(r.horse as { name?: string } | { name?: string }[]);
  return {
    id: String(r.id),
    startsAt: String(r.starts_at),
    endsAt: String(r.ends_at),
    clientName: client?.full_name ?? null,
    horseName: horse?.name ?? null,
    price: num(r.price),
    status: String(r.status),
    notes: (r.notes as string) ?? null,
  };
}

// -------------------------------------------------------------------
// Inbox — requests and to-dos waiting on her
// -------------------------------------------------------------------

/** Lesson requests a client submitted that she hasn't answered. */
export async function getPendingRequests(): Promise<PendingRequest[]> {
  return safe(
    async () => {
      const ctx = await requirePersonalContext();
      const supabase = createSupabaseServerClient();

      const { data } = await supabase
        .from("lesson_requests")
        // Plain embed, matching services/lessonRequests.ts. An explicit
        // `!constraint_name` hint would be guesswork — lesson_requests has
        // a single FK to clients, so PostgREST resolves it unambiguously.
        .select(
          "id, requested_start, requested_duration_min, notes, created_at, requester:clients(full_name)",
        )
        .eq("stable_id", ctx.stableId)
        .eq("status", "pending")
        .order("requested_start", { ascending: true })
        .limit(20);

      return (data ?? []).map((r) => {
        const requester = firstOf(
          r.requester as { full_name?: string } | { full_name?: string }[],
        );
        return {
          id: String(r.id),
          requesterName: requester?.full_name ?? null,
          requestedStart: String(r.requested_start),
          durationMin: num(r.requested_duration_min),
          notes: (r.notes as string) ?? null,
          createdAt: String(r.created_at),
        };
      });
    },
    [],
    "getPendingRequests",
  );
}

/**
 * Her open reminders from the existing Longrein reminders module —
 * contracts to send, emails to answer, anything she already writes down
 * there. Reusing that table rather than inventing a second to-do list is
 * the difference between one place to look and two.
 */
export async function getOpenTodos(now = new Date()): Promise<OpenTodo[]> {
  return safe(
    async () => {
      const ctx = await requirePersonalContext();
      const supabase = createSupabaseServerClient();

      const { data } = await supabase
        .from("reminders")
        .select("id, body, due_at, assigned_to, created_by")
        .eq("stable_id", ctx.stableId)
        .is("completed_at", null)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(25);

      const nowMs = now.getTime();
      return (data ?? [])
        // Assigned to her, or written by her with no assignee (the
        // self-reminder shorthand the reminders module uses).
        .filter(
          (r) =>
            r.assigned_to === ctx.profileId ||
            (r.assigned_to === null && r.created_by === ctx.profileId),
        )
        .map((r) => ({
          id: String(r.id),
          body: String(r.body),
          dueAt: (r.due_at as string) ?? null,
          overdue: Boolean(r.due_at && new Date(r.due_at as string).getTime() < nowMs),
        }));
    },
    [],
    "getOpenTodos",
  );
}
