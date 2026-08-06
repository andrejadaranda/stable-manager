// Daily inbox briefing.
//
// The dashboard only READS here. Writing is done by the recurring
// `tjk-daily-inbox-check` job, which POSTs its summary to
// /api/personal/briefing with a shared secret. That split is deliberate:
// the dashboard has no Gmail credentials and never talks to Google, so
// there is no mailbox access to leak from this codebase.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requirePersonalContext,
  getStableTimeZone,
  safe,
} from "@/services/personalDashboard/common";
import { localDateKey } from "@/services/personalDashboard/core.pure";

export type BriefingItem = {
  title: string;
  detail?: string;
  urgency?: "high" | "normal" | "low";
  actionUrl?: string;
};

export type DailyBriefing = {
  briefingOn: string;
  source: string;
  summary: string | null;
  items: BriefingItem[];
  /** True when the newest briefing is older than today. */
  stale: boolean;
};

/**
 * The most recent briefing, whatever day it's from.
 *
 * Returning yesterday's rather than nothing is the right call: a job that
 * failed to run this morning shouldn't erase context she still finds
 * useful. `stale` lets the UI say so.
 */
export async function getLatestBriefing(now = new Date()): Promise<DailyBriefing | null> {
  return safe(
    async () => {
      const ctx = await requirePersonalContext();
      const tz = await getStableTimeZone();
      const supabase = createSupabaseServerClient();

      const { data } = await supabase
        .from("dashboard_daily_briefings")
        .select("briefing_on, source, summary, items")
        .eq("auth_user_id", ctx.authUserId)
        .order("briefing_on", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return null;

      const briefingOn = String(data.briefing_on);
      return {
        briefingOn,
        source: String(data.source ?? "gmail"),
        summary: (data.summary as string) ?? null,
        items: normaliseItems(data.items),
        stale: briefingOn < localDateKey(now, tz),
      };
    },
    null,
    "getLatestBriefing",
  );
}

/** jsonb is whatever was written into it — validate before rendering. */
function normaliseItems(raw: unknown): BriefingItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BriefingItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const title = typeof e.title === "string" ? e.title : null;
    if (!title) continue;
    out.push({
      title,
      detail: typeof e.detail === "string" ? e.detail : undefined,
      urgency:
        e.urgency === "high" || e.urgency === "low" || e.urgency === "normal"
          ? e.urgency
          : "normal",
      actionUrl: typeof e.action_url === "string" ? e.action_url : undefined,
    });
  }
  return out;
}
