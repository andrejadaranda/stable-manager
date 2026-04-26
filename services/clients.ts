// Clients service.
// Staff (owner + employee) read and write the client roster.
// Clients can read only their own row — handled by RLS; getOwnClient()
// is the dedicated portal entry point.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "pro";

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
  created_at: string;
  updated_at: string;
};

export type ClientWithUpcomingCount = ClientRow & { upcoming_count: number };

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

// List + count of upcoming scheduled lessons. Two queries, one aggregate.
// Used by the clients index page.
export async function listClientsWithUpcomingCount(): Promise<ClientWithUpcomingCount[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();

  const [clientsRes, lessonsRes] = await Promise.all([
    supabase.from("clients").select("*").order("full_name"),
    supabase
      .from("lessons")
      .select("client_id")
      .gte("starts_at", now)
      .eq("status", "scheduled"),
  ]);
  if (clientsRes.error)  throw clientsRes.error;
  if (lessonsRes.error)  throw lessonsRes.error;

  const counts = new Map<string, number>();
  for (const l of (lessonsRes.data ?? []) as Array<{ client_id: string }>) {
    counts.set(l.client_id, (counts.get(l.client_id) ?? 0) + 1);
  }

  return ((clientsRes.data ?? []) as ClientRow[]).map((c) => ({
    ...c,
    upcoming_count: counts.get(c.id) ?? 0,
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
