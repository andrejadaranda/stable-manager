"use client";

// Sprint 4 W1.4 — weather alert configuration UI.
// Backend (migration 56 + cron logic) ships with W1.3.
// This editor lets the owner set coords + thresholds + master toggle.

import { useFormState, useFormStatus } from "react-dom";
import {
  updateWeatherAlertsAction,
  type UpdateWeatherState,
} from "@/app/dashboard/settings/weather/actions";
import {
  DEFAULT_FREEZE_C,
  DEFAULT_HEAT_C,
  type WeatherAlertConfig,
} from "@/services/weatherAlerts.pure";

// "use server" files cannot export runtime consts. Inline the initial.
const initialUpdateWeatherState: UpdateWeatherState = { error: null, success: false };

export function WeatherAlertsEditor({
  initialConfig,
}: {
  initialConfig: WeatherAlertConfig;
}) {
  const [state, formAction] = useFormState<UpdateWeatherState, FormData>(
    updateWeatherAlertsAction,
    initialUpdateWeatherState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* Master toggle */}
      <label className="flex items-start gap-3 p-4 rounded-xl bg-white border border-ink-100">
        <input
          type="checkbox"
          name="weather_alerts_enabled"
          defaultChecked={initialConfig.weather_alerts_enabled}
          className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="flex-1">
          <span className="block text-sm font-medium text-ink-900">Send weather alerts</span>
          <span className="block text-xs text-ink-500 mt-0.5">
            Owners + employees get an email when tomorrow's forecast crosses a threshold. One alert per stable per condition per day.
          </span>
        </span>
      </label>

      {/* Coordinates */}
      <fieldset className="flex flex-col gap-2.5 p-4 rounded-xl bg-white border border-ink-100">
        <legend className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500 px-1">
          Stable location
        </legend>
        <p className="text-xs text-ink-500 -mt-1">
          Used to fetch the local forecast. Look up coords on{" "}
          <a
            href="https://www.openstreetmap.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline"
          >
            OpenStreetMap
          </a>{" "}
          — right-click the spot, choose "Show address."
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-700 font-medium">Latitude</span>
            <input
              type="number"
              name="weather_lat"
              defaultValue={initialConfig.weather_lat ?? ""}
              step="0.00001"
              min={-90}
              max={90}
              placeholder="54.68726"
              className="border border-ink-200 rounded-md px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-700 font-medium">Longitude</span>
            <input
              type="number"
              name="weather_lng"
              defaultValue={initialConfig.weather_lng ?? ""}
              step="0.00001"
              min={-180}
              max={180}
              placeholder="25.27957"
              className="border border-ink-200 rounded-md px-3 py-2 text-sm"
            />
          </label>
        </div>
      </fieldset>

      {/* Thresholds */}
      <fieldset className="flex flex-col gap-2.5 p-4 rounded-xl bg-white border border-ink-100">
        <legend className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500 px-1">
          Thresholds (°C)
        </legend>
        <p className="text-xs text-ink-500 -mt-1">
          Leave a field empty to disable that type of alert.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-700 font-medium">Freeze — notify when low ≤</span>
            <input
              type="number"
              name="weather_freeze_below_c"
              defaultValue={initialConfig.weather_freeze_below_c ?? DEFAULT_FREEZE_C}
              step="0.5"
              min={-40}
              max={20}
              placeholder="0"
              className="border border-ink-200 rounded-md px-3 py-2 text-sm"
            />
            <span className="text-[11px] text-ink-500">
              Blanket time, frozen troughs, paddock walk before dark.
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-700 font-medium">Heat — notify when high ≥</span>
            <input
              type="number"
              name="weather_heat_above_c"
              defaultValue={initialConfig.weather_heat_above_c ?? DEFAULT_HEAT_C}
              step="0.5"
              min={15}
              max={50}
              placeholder="28"
              className="border border-ink-200 rounded-md px-3 py-2 text-sm"
            />
            <span className="text-[11px] text-ink-500">
              Early-morning rides, fly masks, shaded turnout windows.
            </span>
          </label>
        </div>
      </fieldset>

      <Submit />
      {state.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          Saved. Tomorrow's forecast will be checked at the next 6:00 UTC cron pass.
        </p>
      )}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Saving…" : "Save weather alert settings"}
    </button>
  );
}
