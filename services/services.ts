// Stable services service (sorry, the naming overlap is unavoidable).
//
// A service is one row in the stable's price list — e.g. "Private
// lesson · 60 min · €40". When trainers schedule a lesson they pick a
// service, and the lesson's `price` is seeded from `base_price` (the
// trainer can override per-lesson, e.g. for a discount). Clients see
// the active list as a menu in the portal.
//
// RLS:
//   * read  : any stable member (staff + clients)
//   * write : OWNER only

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

// ---------- types -------------------------------------------------

export type ServiceRow = {
  id: string;
  stable_id: string;
  name: string;
  description: string | null;
  base_price: number;
  default_duration_minutes: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CreateServiceInput = {
  name: string;
  description?: string | null;
  basePrice: number;
  defaultDurationMinutes?: number;
  sortOrder?: number;
};

export type UpdateServiceInput = {
  name?: string;
  description?: string | null;
  basePrice?: number;
  defaultDurationMinutes?: number;
  active?: boolean;
  sortOrder?: number;
};

// ---------- writes (owner only) -----------------------------------

export async function createService(input: CreateServiceInput): Promise<ServiceRow> {
  const session = await getSession();
  requireRole(session, "owner");

  const name = input.name.trim();
  if (!name) throw new Error("SERVICE_NAME_REQUIRED");
  if (name.length > 80) throw new Error("SERVICE_NAME_TOO_LONG");
  if (input.basePrice < 0) throw new Error("INVALID_AMOUNT");
  const duration = input.defaultDurationMinutes ?? 45;
  if (duration < 5 || duration > 600) throw new Error("INVALID_DURATION");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      stable_id:                session.stableId,
      name,
      description:              input.description ?? null,
      base_price:               input.basePrice,
      default_duration_minutes: duration,
      sort_order:               input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("SERVICE_NAME_DUPLICATE");
    throw error;
  }
  return data as ServiceRow;
}

export async function updateService(
  serviceId: string,
  input: UpdateServiceInput,
): Promise<ServiceRow> {
  const session = await getSession();
  requireRole(session, "owner");

  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new Error("SERVICE_NAME_REQUIRED");
    if (n.length > 80) throw new Error("SERVICE_NAME_TOO_LONG");
  }
  if (input.basePrice !== undefined && input.basePrice < 0) {
    throw new Error("INVALID_AMOUNT");
  }
  if (input.defaultDurationMinutes !== undefined) {
    if (input.defaultDurationMinutes < 5 || input.defaultDurationMinutes > 600) {
      throw new Error("INVALID_DURATION");
    }
  }

  const update: Record<string, unknown> = {};
  if (input.name        !== undefined) update.name        = input.name.trim();
  if (input.description !== undefined) update.description = input.description;
  if (input.basePrice   !== undefined) update.base_price  = input.basePrice;
  if (input.defaultDurationMinutes !== undefined) {
    update.default_duration_minutes = input.defaultDurationMinutes;
  }
  if (input.active      !== undefined) update.active      = input.active;
  if (input.sortOrder   !== undefined) update.sort_order  = input.sortOrder;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .update(update)
    .eq("id", serviceId)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("SERVICE_NAME_DUPLICATE");
    throw error;
  }
  return data as ServiceRow;
}

export async function deleteService(serviceId: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", serviceId);
  if (error) throw error;
}

// ---------- reads (any member) ------------------------------------

/** Returns services for the calling user's stable.
 *  Staff get the option to include inactive entries; clients get
 *  active-only regardless of the flag. */
export async function listServices(opts?: {
  activeOnly?: boolean;
}): Promise<ServiceRow[]> {
  const session = await getSession();

  // Clients always see active-only — they don't browse archived items.
  const activeOnly = session.role === "client" ? true : opts?.activeOnly ?? false;

  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name",       { ascending: true });

  if (activeOnly) q = q.eq("active", true);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ServiceRow[];
}

export async function getService(serviceId: string): Promise<ServiceRow | null> {
  await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ServiceRow | null;
}
