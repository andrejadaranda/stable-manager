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
  /** True when the client's email OR phone already belongs to a Longrein
   *  auth.user / profile anywhere in the system (any stable). In that
   *  case we hide the Invite button entirely — the person already has
   *  an account they should sign in with, not be re-invited into a new
   *  one. Owner-only field; employees always see false. */
  has_longrein_account: boolean;
  /** Outstanding account balance (total_paid − total_charged). Negative
   *  means the client owes money. Owner-only — defaults to 0 for
   *  employees, who must never see client money (same rule as the
   *  dashboard KPI gating). */
  balance: number;
};

// ------- list -------------------------------------------------------------
export async function listClients(opts?: { activeOnly?: boolean }): Promise<ClientRow[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  let q = supabase.from("clients").select("*").order("full_name");
  if (opts?.activeOnly) q = q.eq("active", true);
  const [clientsRes, ownedRes] = await Promise.all([
    q,
    supabase.from("horses").select("owner_client_id").not("owner_client_id", "is", null),
  ]);
  if (clientsRes.error) throw clientsRes.error;
  if (ownedRes.error)   throw ownedRes.error;
  const horseOwners = new Set<string>(
    ((ownedRes.data ?? []) as Array<{ owner_client_id: string }>).map((r) => r.owner_client_id),
  );
  return ((clientsRes.data ?? []) as Array<Omit<ClientRow, "is_horse_owner_only">>).map((c) => ({
    ...c,
    is_horse_owner_only: horseOwners.has(c.id),
  }));
}

// List + count of upcoming scheduled lessons + pending-invite flag +
// cross-stable existing-Longrein-account flag.
// Multiple parallel queries rather than one aggregate — each one is
// simple, well-indexed, and the joins are easier to reason about.
// Owner-only fields (has_pending_invite, has_longrein_account)
// default to false for employees, who can't read client_invitations
// or call the existing-account RPC.
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

  // Outstanding balance per client — owner-only. Pulled from the
  // client_account_summary view in ONE query (not N), so the list can
  // sort/flag "who owes" without opening each profile. Employees skip it
  // entirely; balance defaults to 0 for them.
  const balancePromise =
    session.role === "owner"
      ? supabase.from("client_account_summary").select("client_id, balance")
      : Promise.resolve({ data: [] as { client_id: string; balance: number }[], error: null });

  const [clientsRes, lessonsRes, invitesRes, ownedHorsesRes, balanceRes] = await Promise.all([
    supabase.from("clients").select("*").order("full_name"),
    supabase
      .from("lessons")
      .select("client_id")
      .gte("starts_at", now)
      .eq("status", "scheduled"),
    invitesPromise,
    // Derive horse-owner status from horses.owner_client_id rather than
    // a dedicated flag — keeps the source of truth in one place.
    supabase
      .from("horses")
      .select("owner_client_id")
      .not("owner_client_id", "is", null),
    balancePromise,
  ]);
  if (clientsRes.error)      throw clientsRes.error;
  if (lessonsRes.error)      throw lessonsRes.error;
  if (invitesRes.error)      throw invitesRes.error;
  if (ownedHorsesRes.error)  throw ownedHorsesRes.error;
  if (balanceRes.error)      throw balanceRes.error;

  const balances = new Map<string, number>();
  for (const r of (balanceRes.data ?? []) as Array<{ client_id: string; balance: number | string }>) {
    balances.set(r.client_id, Number(r.balance ?? 0));
  }

  const horseOwnerIds = new Set<string>();
  for (const h of (ownedHorsesRes.data ?? []) as Array<{ owner_client_id: string }>) {
    if (h.owner_client_id) horseOwnerIds.add(h.owner_client_id);
  }

  const counts = new Map<string, number>();
  for (const l of (lessonsRes.data ?? []) as Array<{ client_id: string }>) {
    counts.set(l.client_id, (counts.get(l.client_id) ?? 0) + 1);
  }

  const pending = new Set<string>();
  for (const r of (invitesRes.data ?? []) as Array<{ client_id: string }>) {
    pending.add(r.client_id);
  }

  const clientRows = (clientsRes.data ?? []) as ClientRow[];

  // Cross-stable account-existence probe — owners only. We collect every
  // unique email/phone from the roster (skipping already-linked clients
  // since their portal status is already known), then hit the SECURITY
  // DEFINER RPC in a single round-trip. Skipped entirely for employees.
  let matchedEmails = new Set<string>();
  let matchedPhones = new Set<string>();
  if (session.role === "owner") {
    const emails: string[] = [];
    const phones: string[] = [];
    for (const c of clientRows) {
      if (c.profile_id) continue;  // already linked — no need to probe
      if (c.email) emails.push(c.email);
      if (c.phone) phones.push(c.phone);
    }
    if (emails.length > 0 || phones.length > 0) {
      // Lazy import to avoid a service<->service dependency cycle
      // (clients.ts ← invitations.ts ← clients.ts via getClient).
      const { findExistingLongreinAccounts } = await import("@/services/invitations");
      const matches = await findExistingLongreinAccounts({ emails, phones })
        .catch(() => ({ matchedEmails: new Set<string>(), matchedPhones: new Set<string>() }));
      matchedEmails = matches.matchedEmails;
      matchedPhones = matches.matchedPhones;
    }
  }

  return clientRows.map((c) => {
    const emailHit = c.email ? matchedEmails.has(c.email.toLowerCase()) : false;
    const phoneHit = c.phone ? matchedPhones.has(c.phone) : false;
    return {
      ...c,
      // Derived flag — true when at least one horse references this client
      // as its owner. Pages segment riders vs horse-owners off this.
      is_horse_owner_only:   horseOwnerIds.has(c.id),
      upcoming_count:        counts.get(c.id) ?? 0,
      has_pending_invite:    pending.has(c.id),
      has_longrein_account:  emailHit || phoneHit,
      balance:               balances.get(c.id) ?? 0,
    };
  });
}

// ------- get one ---------------------------------------------------------
export async function getClient(id: string): Promise<ClientRow | null> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const [clientRes, ownsRes] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("horses").select("id").eq("owner_client_id", id).limit(1),
  ]);
  if (clientRes.error) throw clientRes.error;
  if (!clientRes.data) return null;
  const ownsAtLeastOne = !ownsRes.error && (ownsRes.data?.length ?? 0) > 0;
  return {
    ...(clientRes.data as Omit<ClientRow, "is_horse_owner_only">),
    is_horse_owner_only: ownsAtLeastOne,
  };
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
  // is_horse_owner_only is now derived from horses.owner_client_id and not
  // stored on clients — accept the flag for API compatibility but drop it.
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
