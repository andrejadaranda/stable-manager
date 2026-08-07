"use server";

// Server actions for the command centre.
//
// Every one of these calls requirePersonalContext() through its service —
// a server action is a public HTTP endpoint, so "only the UI calls it" is
// not an access control story. The gate is enforced per call, not per page.

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePersonalContext } from "@/lib/personal/access";
import { generateRecommendations } from "@/services/personalDashboard/advisor";
import { refreshSocialCache } from "@/services/personalDashboard/marketing";
import {
  upsertGoal,
  deleteGoal,
  periodStartKey,
  type GoalPeriod,
  type GoalUnit,
  type GoalCategory,
} from "@/services/personalDashboard/goals";
import { saveIntegrationConfig, type Provider } from "@/services/personalDashboard/settings";
import {
  addFoundingMember,
  setFoundingMemberStatus,
  deleteFoundingMember,
  type FoundingStatus,
} from "@/services/personalDashboard/foundingMembers";
import { getStableTimeZone } from "@/services/personalDashboard/common";
import { localDateKey, monthBounds, quarterStartKey } from "@/services/personalDashboard/core.pure";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Mark a re-engagement suggestion as handled.
 *
 * Default snooze is 14 days: she has just contacted them, so the same
 * "hasn't ridden in a while" nudge shouldn't reappear tomorrow. If they
 * book, the row drops off on its own (a scheduled lesson makes the
 * client "ok" again).
 */
export async function dismissReengagement(
  clientId: string,
  snoozeDays = 14,
): Promise<ActionResult> {
  try {
    const ctx = await requirePersonalContext();
    const tz = await getStableTimeZone();
    const supabase = createSupabaseServerClient();

    const until = new Date();
    until.setDate(until.getDate() + snoozeDays);

    const { error } = await supabase.from("dashboard_dismissals").upsert(
      {
        auth_user_id: ctx.authUserId,
        kind: "reengagement",
        ref_id: clientId,
        snooze_until: localDateKey(until, tz),
      },
      { onConflict: "auth_user_id,kind,ref_id" },
    );
    if (error) throw error;

    revalidatePath("/personal/tjk");
    revalidatePath("/personal");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/** Undo a dismissal — she tapped it by accident, or wants them back. */
export async function undoDismissal(clientId: string): Promise<ActionResult> {
  try {
    const ctx = await requirePersonalContext();
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("dashboard_dismissals")
      .delete()
      .eq("auth_user_id", ctx.authUserId)
      .eq("kind", "reengagement")
      .eq("ref_id", clientId);
    if (error) throw error;
    revalidatePath("/personal/tjk");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/** Force a fresh advisor run for today, replacing this morning's advice. */
export async function regenerateAdvice(): Promise<ActionResult> {
  try {
    const result = await generateRecommendations({ force: true });
    revalidatePath("/personal");
    if (result.status === "not_configured") {
      return { ok: false, error: "ANTHROPIC_API_KEY nenustatytas." };
    }
    if (result.status !== "ok") {
      return { ok: false, error: "Nepavyko sugeneruoti patarimų. Bandyk vėliau." };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/** Pull fresh Instagram / Facebook / tjk.lt metrics into the cache. */
export async function refreshMarketing(): Promise<ActionResult> {
  try {
    const result = await refreshSocialCache();
    revalidatePath("/personal/marketing");
    if (result.errors.length > 0) return { ok: false, error: result.errors.join(" ") };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/** Create or update a goal for the current month/quarter. */
export async function saveGoalAction(formData: FormData): Promise<ActionResult> {
  try {
    const tz = await getStableTimeZone();
    const now = new Date();

    const period = String(formData.get("period") ?? "month") as GoalPeriod;
    if (period !== "week" && period !== "month" && period !== "quarter") {
      return { ok: false, error: "Netinkamas laikotarpis." };
    }

    const rawCategory = String(formData.get("category") ?? "").trim();
    const category = (["tjk", "longrein", "rinkodara"] as const).includes(
      rawCategory as GoalCategory,
    )
      ? (rawCategory as GoalCategory)
      : null;

    const target = Number(String(formData.get("target") ?? "").replace(",", "."));
    if (!Number.isFinite(target) || target <= 0) {
      return { ok: false, error: "Įvesk tikslą — skaičių, didesnį už nulį." };
    }

    await upsertGoal({
      period,
      // The period is always "the one we're in now" — a goal for a month
      // that has already ended isn't something she'd set from this screen.
      periodStart: periodStartKey(period, now, tz),
      goalKey: String(formData.get("goalKey") ?? "").trim(),
      label: String(formData.get("label") ?? "").trim() || "Tikslas",
      target,
      unit: (String(formData.get("unit") ?? "count") as GoalUnit) ?? "count",
      category,
      sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
    });

    revalidatePath("/personal/tikslai");
    revalidatePath("/personal/finansai");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

export async function deleteGoalAction(id: string): Promise<ActionResult> {
  try {
    await deleteGoal(id);
    revalidatePath("/personal/tikslai");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/**
 * Save integration credentials.
 *
 * Values arrive from a form and go straight into the RLS-protected
 * settings table. Nothing is echoed back — the Settings screen only ever
 * renders a masked hint.
 */
export async function saveSettingsAction(formData: FormData): Promise<ActionResult> {
  try {
    const provider = String(formData.get("provider") ?? "") as Provider;
    const allowed: Provider[] = [
      "instagram",
      "facebook",
      "website",
      "anthropic",
      "monitoring",
      "longrein",
      "briefing",
    ];
    // "push" is deliberately absent: that row holds a generated VAPID
    // keypair, and letting a form overwrite it would silently orphan
    // every existing device subscription.
    if (!allowed.includes(provider)) {
      return { ok: false, error: "Nežinoma integracija." };
    }

    const config: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (key === "provider") continue;
      if (typeof value !== "string") continue;
      config[key] = value.trim();
    }

    // Plan prices arrive as flat `price_<plan>` fields and are nested
    // here, because that's the shape services/personalDashboard/longrein.ts
    // reads them in.
    if (provider === "longrein") {
      const planPrices: Record<string, number> = {};
      for (const [key, value] of Object.entries(config)) {
        if (!key.startsWith("price_")) continue;
        delete config[key];
        const n = Number(String(value).replace(",", "."));
        if (Number.isFinite(n) && n > 0) planPrices[key.slice(6)] = n;
      }
      if (Object.keys(planPrices).length > 0) config.planPrices = planPrices;
    }

    await saveIntegrationConfig(provider, config);
    revalidatePath("/personal/nustatymai");
    revalidatePath("/personal/marketing");
    revalidatePath("/personal/longrein");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

// -------------------------------------------------------------------
// Founding Members roster
// -------------------------------------------------------------------
// A hand-maintained list, because the Founding 15 are hand-billed and
// have no representation anywhere in the product schema to derive from.

export async function addFoundingMemberAction(formData: FormData): Promise<ActionResult> {
  try {
    const fullName = String(formData.get("fullName") ?? "").trim();
    if (!fullName) return { ok: false, error: "Įvesk vardą." };

    const rawPrice = String(formData.get("monthlyEur") ?? "").replace(",", ".");
    const monthlyEur = Number(rawPrice);

    await addFoundingMember({
      fullName,
      email: String(formData.get("email") ?? ""),
      // Default €25 — the Founding Member lifetime price. She can change
      // it per member, because the lock-in is negotiated individually.
      monthlyEur: Number.isFinite(monthlyEur) && monthlyEur >= 0 ? monthlyEur : 25,
      notes: String(formData.get("notes") ?? ""),
    });

    revalidatePath("/personal/longrein");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

export async function setFoundingMemberStatusAction(
  id: string,
  status: FoundingStatus,
): Promise<ActionResult> {
  try {
    await setFoundingMemberStatus(id, status);
    revalidatePath("/personal/longrein");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

export async function deleteFoundingMemberAction(id: string): Promise<ActionResult> {
  try {
    await deleteFoundingMember(id);
    revalidatePath("/personal/longrein");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

function message(err: unknown): string {
  // NOT_FOUND is the access gate throwing. Don't confirm the route exists.
  if (err instanceof Error && err.message === "NOT_FOUND") return "Nerasta.";
  return err instanceof Error ? err.message : "Įvyko klaida.";
}
