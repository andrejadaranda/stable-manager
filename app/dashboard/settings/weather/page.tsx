// Weather alerts — owner-only operations setting.

import { requirePageRole } from "@/lib/auth/redirects";
import { getWeatherAlertConfig } from "@/services/weatherAlerts";
import { WeatherAlertsEditor } from "@/components/settings/weather-alerts-editor";

export const dynamic = "force-dynamic";

export default async function WeatherAlertsPage() {
  await requirePageRole("owner");
  const config = await getWeatherAlertConfig();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-xl text-navy-700">Weather alerts</h2>
        <p className="text-sm text-ink-500 mt-1.5">
          Get an email when tomorrow's forecast crosses a freeze or heat threshold. Helps grooms plan blankets, troughs, fly masks, and ride windows.
        </p>
      </header>
      <WeatherAlertsEditor initialConfig={config} />
    </div>
  );
}
