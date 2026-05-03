// Settings → Features. Per-stable on/off toggles for non-core modules.
//
// Owner sees a grouped list (Schedule / Money / Communication / Welfare),
// each row has a description + a toggle. Flipping a toggle hits a
// server action and re-validates the entire dashboard so the sidebar
// + Settings tabs adapt instantly.
//
// Defaults: every feature on. A small private livery yard turning off
// "packages / services / boarding" sees a much simpler product. A
// riding school turning off "boarding / agreements" same.

import { requirePageRole } from "@/lib/auth/redirects";
import {
  getStableFeatures,
  FEATURE_KEYS,
  FEATURE_META,
  type FeatureKey,
} from "@/services/features";
import { FeatureToggleRow } from "@/components/settings/feature-toggle-row";
import { HelpHint } from "@/components/ui";

export const dynamic = "force-dynamic";

const GROUP_ORDER: Array<"Schedule" | "Money" | "Communication" | "Welfare"> = [
  "Schedule",
  "Money",
  "Communication",
  "Welfare",
];

const GROUP_BLURB: Record<string, string> = {
  Schedule:      "What appears around the calendar — sessions, recurring lessons.",
  Money:         "What appears in payments and the price list — packages, services, boarding, charges.",
  Communication: "How your stable talks to clients — chat, agreements, public horse bios, reminders.",
  Welfare:       "How strict horse welfare rules behave — hard blocks vs. soft warnings.",
};

export default async function FeaturesSettingsPage() {
  await requirePageRole("owner");
  const features = await getStableFeatures();

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">
          Features
        </h2>
        <p className="text-sm text-ink-500 mt-1 max-w-2xl leading-relaxed">
          Hide modules you don't use so your team only sees what's relevant.
          You can turn things back on at any time — your data stays put.
        </p>
      </div>

      {GROUP_ORDER.map((group) => {
        const keys = FEATURE_KEYS.filter((k) => FEATURE_META[k].group === group);
        if (keys.length === 0) return null;
        return (
          <section
            key={group}
            className="bg-white rounded-2xl shadow-soft overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-ink-100">
              <h3 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
                {group}
              </h3>
              <p className="text-[12.5px] text-ink-700 mt-1">
                {GROUP_BLURB[group]}
              </p>
            </div>
            <ul className="divide-y divide-ink-100">
              {keys.map((k: FeatureKey) => (
                <FeatureToggleRow
                  key={k}
                  featureKey={k}
                  label={FEATURE_META[k].label}
                  description={FEATURE_META[k].description}
                  enabled={features[k]}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
