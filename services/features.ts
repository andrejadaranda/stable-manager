// Per-stable feature toggles.
//
// The owner picks which modules show in the sidebar and Settings.
// Storage is a jsonb column on stables (migration 29). New feature
// keys are coerced to their default value when missing — so adding
// a feature later doesn't break older stables.
//
// Server reads cached per request via getStableFeatures(); the
// FEATURE_META map is the single source of truth for label/description
// shown in the toggle UI.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

// Order here = order in the toggle UI. Keep core/most-used at top.
export const FEATURE_KEYS = [
  "sessions",
  "packages",
  "services",
  "boarding",
  "client_charges",
  "reminders",
  "agreements",
  "public_horse_bios",
  "chat",
  "recurring_lessons",
  "welfare_hard_limits",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type StableFeatures = Record<FeatureKey, boolean>;

export const DEFAULT_FEATURES: StableFeatures = {
  sessions:            true,
  packages:            true,
  services:            true,
  boarding:            true,
  client_charges:      true,
  reminders:           true,
  agreements:          true,
  public_horse_bios:   true,
  chat:                false,  // Deprioritized — Founding Members use WhatsApp; flag OFF by default 2026-05-02.
  recurring_lessons:   true,
  welfare_hard_limits: true,
};

/** Display metadata for the Settings → Features toggle list. */
export const FEATURE_META: Record<
  FeatureKey,
  { label: string; description: string; group: "Schedule" | "Money" | "Communication" | "Welfare" }
> = {
  sessions: {
    label: "Session log",
    description:
      "Track every ride that happened — flat, jumping, lunging, hack. Off if you only schedule lessons and don't log freelance rides.",
    group: "Schedule",
  },
  recurring_lessons: {
    label: "Recurring weekly lessons",
    description:
      "Book a lesson and copy it weekly for the next 4–12 weeks in one click. Off if all your bookings are one-off.",
    group: "Schedule",
  },
  packages: {
    label: "Lesson packages (abonements)",
    description:
      "Sell prepaid lesson bundles (e.g. 8 lessons / month). Off if you charge per lesson only.",
    group: "Money",
  },
  services: {
    label: "Services & price list",
    description:
      "Catalog of lesson types with auto-fill price and duration. Off if every lesson is the same price.",
    group: "Money",
  },
  boarding: {
    label: "Horse boarding fees",
    description:
      "Charge clients for keeping their horse at your yard. Off if you don't board outside horses.",
    group: "Money",
  },
  client_charges: {
    label: "Misc client charges",
    description:
      "Bill farrier visits, equipment, transport — anything that isn't a lesson or boarding. Off if you only charge for lessons.",
    group: "Money",
  },
  agreements: {
    label: "Client agreements",
    description:
      "Track signed boarding contracts, liability waivers, riding agreements per client.",
    group: "Communication",
  },
  reminders: {
    label: "Reminders & to-dos",
    description:
      "Apple-Reminders style task list shared with your team. Off if you keep tasks elsewhere.",
    group: "Communication",
  },
  chat: {
    label: "Chat",
    description:
      "In-app chat with your team and clients. Off if you handle messaging in WhatsApp / Messenger.",
    group: "Communication",
  },
  public_horse_bios: {
    label: "Public horse bios",
    description:
      "Owners can add a public-friendly bio to each horse, shown to clients in their lesson view. Off to keep all horse data internal.",
    group: "Communication",
  },
  welfare_hard_limits: {
    label: "Strict welfare limits",
    description:
      "Block lesson booking when daily/weekly horse limit hit (with override + audit). Off to make limits soft warnings only.",
    group: "Welfare",
  },
};

/** Owners read for management, others read for visibility — both allowed. */
export async function getStableFeatures(): Promise<StableFeatures> {
  const session = await getSession();
  void session;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stables")
    .select("features")
    .single();

  if (error || !data) return { ...DEFAULT_FEATURES };

  return coerce(data.features as Record<string, unknown> | null);
}

/** Coerce arbitrary jsonb into a fully populated StableFeatures. */
function coerce(raw: Record<string, unknown> | null | undefined): StableFeatures {
  const out: StableFeatures = { ...DEFAULT_FEATURES };
  if (!raw) return out;
  for (const k of FEATURE_KEYS) {
    if (typeof raw[k] === "boolean") out[k] = raw[k] as boolean;
  }
  return out;
}

/** Plain helper — does this map of features have the key enabled? */
export function isFeatureEnabled(features: StableFeatures, key: FeatureKey): boolean {
  return features[key] === true;
}

/** Owner-only: flip a single feature flag. */
export async function setStableFeature(key: FeatureKey, value: boolean): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner");

  if (!FEATURE_KEYS.includes(key)) {
    throw new Error(`Unknown feature key: ${key}`);
  }

  const supabase = createSupabaseServerClient();
  // Read current to merge — avoids clobbering keys we don't know about
  // (forward-compat with future feature additions).
  const current = await getStableFeatures();
  const next = { ...current, [key]: value };

  const { error } = await supabase
    .from("stables")
    .update({ features: next })
    .eq("id", session.stableId);

  if (error) throw error;

  // Settings + sidebar both depend on these — invalidate broadly.
  revalidatePath("/dashboard", "layout");
}
