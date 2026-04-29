// Reminders service. Stable-scoped, role-agnostic — anyone in the
// stable can write a reminder for themselves or for another member.
// RLS narrows visibility (creator + assignee) so cross-talk between
// roles works without app-level access checks.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

// ---------- types -----------------------------------------------

export type ReminderRow = {
  id: string;
  stable_id: string;
  created_by: string;
  assigned_to: string | null;
  body: string;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Joined display fields. */
  creator: { id: string; full_name: string | null } | null;
  assignee: { id: string; full_name: string | null } | null;
};

export type CreateReminderInput = {
  body: string;
  /** profiles.id of the person who should do the thing. Null/undefined
   *  means a self-reminder; the row stores that as NULL and the UI
   *  treats it as "= created_by". */
  assignedTo?: string | null;
  /** ISO timestamp. Optional — not every reminder has a deadline. */
  dueAt?: string | null;
};

// ---------- writes ----------------------------------------------

export async function createReminder(input: CreateReminderInput): Promise<ReminderRow> {
  const session = await getSession();
  // Any stable role can create reminders. Visibility is RLS-narrowed.
  requireRole(session, "owner", "employee", "client");

  const body = input.body.trim();
  if (!body) throw new Error("REMINDER_EMPTY");
  if (body.length > 500) throw new Error("REMINDER_TOO_LONG");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reminders")
    .insert({
      stable_id:   session.stableId,
      created_by:  session.userId,
      assigned_to: input.assignedTo ?? null,
      body,
      due_at:      input.dueAt ?? null,
    })
    .select(SELECT_WITH_LABELS)
    .single();
  if (error) throw error;
  return data as unknown as ReminderRow;
}

/** Mark complete (or un-complete) — either creator or assignee can do it.
 *  Pass `null` to un-complete. */
export async function setReminderCompleted(
  reminderId: string,
  completedAt: string | null,
): Promise<void> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("reminders")
    .update({ completed_at: completedAt })
    .eq("id", reminderId);
  if (error) throw error;
}

export async function deleteReminder(reminderId: string): Promise<void> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("reminders").delete().eq("id", reminderId);
  if (error) throw error;
}

// ---------- reads -----------------------------------------------

const SELECT_WITH_LABELS = `
  id, stable_id, created_by, assigned_to, body, due_at, completed_at, created_at, updated_at,
  creator:profiles!reminders_created_by_fkey(id, full_name),
  assignee:profiles!reminders_assigned_to_fkey(id, full_name)
`;

/** All open reminders the caller can see (assigned to them + ones they
 *  created). Sorted by due date with no-due last, completed hidden. */
export async function listOpenReminders(): Promise<ReminderRow[]> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reminders")
    .select(SELECT_WITH_LABELS)
    .is("completed_at", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReminderRow[];
}

/** Recently completed reminders (last 30) — used for the "Done" tab so
 *  users can un-check accidentally-tapped items without losing them. */
export async function listRecentCompletedReminders(limit = 30): Promise<ReminderRow[]> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reminders")
    .select(SELECT_WITH_LABELS)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ReminderRow[];
}

// ---------- assignable people list ------------------------------

export type AssignablePerson = {
  id: string;        // profile id
  full_name: string;
  role: "owner" | "employee" | "client";
};

/** Returns the people the caller can assign reminders to. Owners +
 *  employees see every staff + client member. Clients see their own
 *  trainers (the staff they've taken lessons with) + themselves. */
export async function listAssignablePeople(): Promise<AssignablePerson[]> {
  const session = await getSession();
  const supabase = createSupabaseServerClient();

  if (session.role === "client") {
    // Trainers the client has taken lessons with — already exposed by
    // the existing 07_calendar_policies. Plus the client's own profile.
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name");
    if (error) throw error;
    return (data ?? []) as AssignablePerson[];
  }

  // Staff: every member in the stable.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as AssignablePerson[];
}
