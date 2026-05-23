// Clients service.
// Staff (owner + employee) read and write the client roster.
// Clients can read only their own row — handled by RLS; getOwnClient()
// is the dedicated portal entry point.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "pro";

/** Lesson-reminder channel preference per client.
 *  Captured at client-creation time; cron-driven dispatch lands in #34. */
export type ReminderPref = "none" | "email" | "sms" | "both";

export type ClientRow = {
  id: string;
  stable_id: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  default_lesson_price: number | null;
  skill_level: SkillLevel | null;
  active: boolean;
  notes: string | null;
  /** Emergency contact name — for accidents during a lesson. */
  emergency_contact_name:     string | null;
  /** Emergency contact phone. */
  emergency_contact_phone:    string | null;
  /** Free-text relationship: spouse / parent / friend / etc. */
  emergency_contact_relation: string | null;
  /** True when client is purely a horse-owner (boarder), not a rider.
   *  Drives Clients-page segmentation + skips skill-level requirement. */
  is_horse_owner_only: boolean;
  /** How (if at all) the client wants to be reminded about upcoming lessons. */
  reminder_pref: ReminderPref;
  created_at: string;
  updated_at: string;
};

export type ClientWithUpcomingCount = ClientRow & {
  upcoming_count: number;
  /** True when a non-used, non-revoked, non-expired client_invitations
   *  row exists for this client. Used to render "Resend invite" instead
   *  of "Invite to app" on the client list. */
  has_pending_invite: boolean;
};

// ------- list -------------------------------------------------------------
export async function listClients(opts?: { activeOnly?: boolean }): Promise<ClientRow[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  let q = supabase.from("clients").select("*").order("full_name");
  if (opts?.activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ClientRow[];
}

// List + count of upcoming scheduled lessons + pending-invite flag.
// Three queries instead of one aggregate — keeps each query simple and
// the joins manageable. Used by the clients index page (owner only —
// pending invites are owner-scoped per RLS).
export async function listClientsWithUpcomingCount(): Promise<ClientWithUpcomingCount[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();

  // Employees can't read client_invitations (owner-only RLS), so skip
  // that query for them — the field defaults to false.
  const invitesPromise =
    session.role === "owner"
      ? supabase
          .from("client_invitations")
          .select("client_id")
          .is("used_at", null)
          .is("revoked_at", null)
          .gt("expires_at", now)
      : Promise.resolve({ data: [] as { client_id: string }[], error: null });

  const [clientsRes, lessonsRes, invitesRes] = await Promise.all([
    supabase.from("clients").select("*").order("full_name"),
    supabase
      .from("lessons")
      .select("client_id")
      .gte("starts_at", now)
      .eq("status", "scheduled"),
    invitesPromise,
  ]);
  if (clientsRes.error)  throw clientsRes.error;
  if (lessonsRes.error)  throw lessonsRes.error;
  if (invitesRes.error)  throw invitesRes.error;

  const counts = new Map<string, number>();
  for (const l of (lessonsRes.data ?? []) as Array<{ client_id: string }>) {
    counts.set(l.client_id, (counts.get(l.client_id) ?? 0) + 1);
  }

  const pending = new Set<string>();
  for (const r of (invitesRes.data ?? []) as Array<{ client_id: string }>) {
    pending.add(r.client_id);
  }

  return ((clientsRes.data ?? []) as ClientRow[]).map((c) => ({
    ...c,
    upcoming_count:      counts.get(c.id) ?? 0,
    has_pending_invite:  pending.has(c.id),
  }));
}

// ------- get one ---------------------------------------------------------
export async function getClient(id: string): Promise<ClientRow | null> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ClientRow) ?? null;
}

// ------- create ----------------------------------------------------------
export async function createClient(input: {
  fullName: string;
  email?: string;
  phone?: string;
  skillLevel?: SkillLevel;
  active?: boolean;
  defaultLessonPrice?: number;
  notes?: string;
  reminderPref?: ReminderPref;
}) {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      stable_id: session.stableId,
      full_name: input.fullName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      default_lesson_price: input.defaultLessonPrice ?? null,
      skill_level: input.skillLevel ?? null,
      active: input.active ?? true,
      notes: input.notes ?? null,
      reminder_pref: input.reminderPref ?? "none",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ------- update -----------------------------------------------------------
export type UpdateClientInput = {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  skillLevel?: SkillLevel | null;
  active?: boolean;
  notes?: string | null;
  emergencyContactName?:     string | null;
  emergencyContactPhone?:    string | null;
  emergencyContactRelation?: string | null;
  isHorseOwnerOnly?:         boolean;
  reminderPref?:             ReminderPref;
};

export async function updateClient(id: string, input: UpdateClientInput) {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const update: Record<string, unknown> = {};
  if (input.fullName    !== undefined) update.full_name   = input.fullName;
  if (input.email       !== undefined) update.email       = input.email;
  if (input.phone       !== undefined) update.phone       = input.phone;
  if (input.skillLevel  !== undefined) update.skill_level = input.skillLevel;
  if (input.active      !== undefined) update.active      = input.active;
  if (input.notes       !== undefined) update.notes       = input.notes;
  if (input.emergencyContactName     !== undefined) update.emergency_contact_name     = input.emergencyContactName;
  if (input.emergencyContactPhone    !== undefined) update.emergency_contact_phone    = input.emergencyContactPhone;
  if (input.emergencyContactRelation !== undefined) update.emergency_contact_relation = input.emergencyContactRelation;
  if (input.isHorseOwnerOnly         !== undefined) update.is_horse_owner_only        = input.isHorseOwnerOnly;
  if (input.reminderPref             !== undefined) update.reminder_pref              = input.reminderPref;

  const { data, error } = await supabase
    .from("clients")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Owner-only: clients without a portal account, for the invite-client form.
export async function listUnlinkedClients(): Promise<{ id: string; full_name: string }[]> {
  const session = await getSession();
  requireRole(session, "owner");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name")
    .is("profile_id", null)
    .eq("active", true)
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as { id: string; full_name: string }[];
}

// ------- portal: own record ----------------------------------------------
export async function getOwnClient() {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");
  if (!session.clientId) throw new Error("CLIENT_NOT_LINKED");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", session.clientId)
    .single();
  if (error) throw error;
  return data;
}
