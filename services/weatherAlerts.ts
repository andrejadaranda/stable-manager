// Per-stable weather-alert configuration.
//
// Storage: stables.{weather_lat, weather_lng, weather_freeze_below_c,
// weather_heat_above_c, weather_alerts_enabled} (migration 56).
//
// The actual alert dispatch lives in /api/cron/reminders (daily 6am UTC).

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type { WeatherAlertConfig } from "./weatherAlerts.pure";
export { DEFAULT_FREEZE_C, DEFAULT_HEAT_C } from "./weatherAlerts.pure";
import type { WeatherAlertConfig } from "./weatherAlerts.pure";

export async function getWeatherAlertConfig(): Promise<WeatherAlertConfig> {
  const ctx = await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stables")
    .select(`
      weather_lat, weather_lng,
      weather_freeze_below_c, weather_heat_above_c,
      weather_alerts_enabled
    `)
    .eq("id", ctx.stableId)
    .single();
  if (error) throw error;
  return data as WeatherAlertConfig;
}

export type UpdateWeatherAlertInput = {
  lat:               number | null;
  lng:               number | null;
  freezeBelowC:      number | null;
  heatAboveC:        number | null;
  alertsEnabled:     boolean;
};

export async function updateWeatherAlertConfig(input: UpdateWeatherAlertInput): Promise<void> {
  const ctx = await getSession();
  requireRole(ctx, "owner");

  // Sanity bounds — keep the DB clean and the cron predictable.
  if (input.lat != null && (input.lat < -90 || input.lat > 90)) {
    throw new Error("INVALID_LAT");
  }
  if (input.lng != null && (input.lng < -180 || input.lng > 180)) {
    throw new Error("INVALID_LNG");
  }
  if (input.freezeBelowC != null && (input.freezeBelowC < -40 || input.freezeBelowC > 20)) {
    throw new Error("INVALID_FREEZE_THRESHOLD");
  }
  if (input.heatAboveC != null && (input.heatAboveC < 15 || input.heatAboveC > 50)) {
    throw new Error("INVALID_HEAT_THRESHOLD");
  }

  // Belt-and-braces: enabling alerts without coords is meaningless and
  // would silently no-op the cron. Surface the error instead of pretending it worked.
  if (input.alertsEnabled && (input.lat == null || input.lng == null)) {
    throw new Error("MISSING_COORDS");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("stables")
    .update({
      weather_lat:            input.lat,
      weather_lng:            input.lng,
      weather_freeze_below_c: input.freezeBelowC,
      weather_heat_above_c:   input.heatAboveC,
      weather_alerts_enabled: input.alertsEnabled,
    })
    .eq("id", ctx.stableId);
  if (error) throw error;
}
