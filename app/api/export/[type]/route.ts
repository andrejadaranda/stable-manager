// Owner-only CSV export endpoint. Streams a single CSV per table.
// Hit `/api/export/clients`, `/api/export/horses`, etc. The Settings
// "Download my data" page links to each one.
//
// RLS on every table narrows to the caller's stable, so this endpoint
// has no manual `where stable_id = ...` — it just SELECTs and trusts
// Postgres. Owner role check is the only app-level gate.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { toCsv } from "@/lib/utils/csv";

export const dynamic = "force-dynamic";

// Whitelist of tables + the SELECT projection. Anything not on this
// list returns 404, so an attacker can't enumerate Postgres schemas.
const EXPORTS: Record<string, { table: string; select: string }> = {
  clients: {
    table:  "clients",
    select: "id, full_name, email, phone, skill_level, default_lesson_price, active, notes, created_at",
  },
  horses: {
    table:  "horses",
    select: "id, name, breed, date_of_birth, daily_lesson_limit, weekly_lesson_limit, monthly_boarding_fee, available_for_lessons, owner_client_id, public_bio, active, notes, created_at",
  },
  lessons: {
    table:  "lessons",
    select: "id, starts_at, ends_at, status, price, horse_id, client_id, trainer_id, package_id, service_id, over_limit_reason, notes, created_at",
  },
  payments: {
    table:  "payments",
    select: "id, amount, method, paid_at, client_id, lesson_id, package_id, boarding_charge_id, client_charge_id, notes, created_at",
  },
  packages: {
    table:  "lesson_packages",
    select: "id, client_id, total_lessons, price, purchased_at, expires_at, notes, created_at",
  },
  boarding_charges: {
    table:  "horse_boarding_charges",
    select: "id, horse_id, owner_client_id, period_start, period_end, period_label, amount, notes, created_at",
  },
  misc_charges: {
    table:  "client_charges",
    select: "id, client_id, horse_id, kind, custom_label, amount, incurred_on, notes, created_at",
  },
  expenses: {
    table:  "expenses",
    select: "id, category, amount, description, horse_id, incurred_on, created_at",
  },
  services: {
    table:  "services",
    select: "id, name, description, base_price, default_duration_minutes, active, sort_order, created_at",
  },
  agreements: {
    table:  "client_agreements",
    select: "id, client_id, kind, custom_label, signed_at, required_for_boarders, notes, created_at",
  },
  sessions: {
    table:  "sessions",
    select: "id, horse_id, rider_client_id, rider_profile_id, rider_name_freeform, trainer_id, lesson_id, started_at, duration_minutes, type, rating, notes, created_at",
  },
  reminders: {
    table:  "reminders",
    select: "id, created_by, assigned_to, body, due_at, completed_at, created_at",
  },
};

export async function GET(
  _req: Request,
  { params }: { params: { type: string } },
) {
  const session = await getSession().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    requireRole(session, "owner");
  } catch {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  const cfg = EXPORTS[params.type];
  if (!cfg) {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from(cfg.table).select(cfg.select);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = toCsv((data ?? []) as unknown as Array<Record<string, unknown>>);
  // Tag the filename so the user gets stable-clients-2026-04-29.csv etc.
  const date = new Date().toISOString().slice(0, 10);
  const filename = `stable-${params.type}-${date}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type":         "text/csv; charset=utf-8",
      "Content-Disposition":  `attachment; filename="${filename}"`,
      // Don't cache — each call should hit fresh data.
      "Cache-Control":        "no-store",
    },
  });
}
