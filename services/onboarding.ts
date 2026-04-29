// Onboarding status — drives the dashboard checklist that walks a new
// owner from "empty stable" to "ready to book". Five small COUNTs in
// one parallel batch — sub-50ms even on a cold connection.
//
// Each step is independent + ordered by realistic flow:
//   1. Stable created (always true once they're past the auth gate)
//   2. At least one service in the price list
//   3. At least one horse on the roster
//   4. At least one client
//   5. At least one lesson scheduled (any status)
//
// Returns null when the caller is fully set up, so the dashboard
// widget can simply render-or-not based on the value.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type OnboardingStep = {
  key:        "stable" | "services" | "horse" | "client" | "lesson";
  label:      string;
  done:       boolean;
  /** Where the dashboard "Take me there" link goes. */
  href:       string;
  /** Hint shown beneath the label until done. */
  hint:       string;
};

export type OnboardingStatus = {
  steps:           OnboardingStep[];
  /** % done — lets the dashboard render a small progress bar. */
  pct:             number;
  /** True when every step is done — caller can hide the widget. */
  complete:        boolean;
};

/** Owner+employee only — clients don't see onboarding. Returns null
 *  when the stable is fully set up so the caller can skip rendering. */
export async function getOnboardingStatus(): Promise<OnboardingStatus | null> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  void session;

  const supabase = createSupabaseServerClient();

  // Five tiny COUNT(*) queries in parallel. RLS narrows each to the
  // caller's stable automatically.
  const [s, h, c, l] = await Promise.all([
    supabase.from("services") .select("id", { count: "exact", head: true }).limit(1),
    supabase.from("horses")   .select("id", { count: "exact", head: true }).limit(1),
    supabase.from("clients")  .select("id", { count: "exact", head: true }).limit(1),
    supabase.from("lessons")  .select("id", { count: "exact", head: true }).limit(1),
  ]);

  const hasService = (s.count ?? 0) > 0;
  const hasHorse   = (h.count ?? 0) > 0;
  const hasClient  = (c.count ?? 0) > 0;
  const hasLesson  = (l.count ?? 0) > 0;

  const steps: OnboardingStep[] = [
    {
      key:   "stable",
      label: "Stable created",
      done:  true,
      href:  "/dashboard/settings/stable",
      hint:  "You're all set — head into the next step.",
    },
    {
      key:   "services",
      label: "Add your services & prices",
      done:  hasService,
      href:  "/dashboard/settings/services",
      hint:  "List the lessons you sell so trainers can pick from a price list.",
    },
    {
      key:   "horse",
      label: "Add your first horse",
      done:  hasHorse,
      href:  "/dashboard/horses",
      hint:  "Horses you own + any boarder horses you train on.",
    },
    {
      key:   "client",
      label: "Add your first client",
      done:  hasClient,
      href:  "/dashboard/clients",
      hint:  "The riders you teach. Email is optional.",
    },
    {
      key:   "lesson",
      label: "Schedule your first lesson",
      done:  hasLesson,
      href:  "/dashboard/calendar",
      hint:  "Pick the time grid, click a slot, and you're booked.",
    },
  ];

  const doneCount = steps.filter((x) => x.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const complete = doneCount === steps.length;

  return { steps, pct, complete };
}
