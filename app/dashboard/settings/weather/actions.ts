"use server";

import { revalidatePath } from "next/cache";
import { updateWeatherAlertConfig } from "@/services/weatherAlerts";

// IMPORTANT: A "use server" file can ONLY export async functions in
// Next 14. The initial-state literal lives inline in the consuming
// client component (weather-alerts-editor.tsx) instead.
export type UpdateWeatherState = { error: string | null; success: boolean };

const ERROR_COPY: Record<string, string> = {
  INVALID_LAT:              "Latitude must be between -90 and 90.",
  INVALID_LNG:              "Longitude must be between -180 and 180.",
  INVALID_FREEZE_THRESHOLD: "Freeze threshold should be between -40°C and 20°C.",
  INVALID_HEAT_THRESHOLD:   "Heat threshold should be between 15°C and 50°C.",
  MISSING_COORDS:           "Add stable coordinates (lat + lng) before enabling alerts.",
  FORBIDDEN:                "Only the stable owner can change weather alerts.",
  UNAUTHENTICATED:          "Your session expired. Sign in again.",
};

export async function updateWeatherAlertsAction(
  _prev: UpdateWeatherState,
  formData: FormData,
): Promise<UpdateWeatherState> {
  const latRaw    = String(formData.get("weather_lat") ?? "").trim();
  const lngRaw    = String(formData.get("weather_lng") ?? "").trim();
  const freezeRaw = String(formData.get("weather_freeze_below_c") ?? "").trim();
  const heatRaw   = String(formData.get("weather_heat_above_c") ?? "").trim();
  const enabled   = formData.get("weather_alerts_enabled") === "on";

  const parseNum = (raw: string): number | null => {
    if (raw === "") return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };

  try {
    await updateWeatherAlertConfig({
      lat:           parseNum(latRaw),
      lng:           parseNum(lngRaw),
      freezeBelowC:  parseNum(freezeRaw),
      heatAboveC:    parseNum(heatRaw),
      alertsEnabled: enabled,
    });
  } catch (err: any) {
    const code = err?.message ?? "";
    return { error: ERROR_COPY[code] ?? `Could not save: ${code || "unknown error"}.`, success: false };
  }

  revalidatePath("/dashboard/settings/weather");
  return { error: null, success: true };
}
