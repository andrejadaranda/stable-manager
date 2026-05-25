// Pure types for weatherAlerts — safe for client components.
// Server queries live in services/weatherAlerts.ts and re-export from here.

export type WeatherAlertConfig = {
  weather_lat:             number | null;
  weather_lng:             number | null;
  weather_freeze_below_c:  number | null;
  weather_heat_above_c:    number | null;
  weather_alerts_enabled:  boolean;
};

/** Sensible defaults shown in the editor when nothing is set yet. */
export const DEFAULT_FREEZE_C = 0;   // freeze threshold — water troughs, blanket time
export const DEFAULT_HEAT_C   = 28;  // heat threshold — early ride / shaded turnout
