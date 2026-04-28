// Tab strip for the horse profile. Five tabs, URL-driven via ?tab=.
// Pure presentational; no state. Each Link is server-render-friendly.

import Link from "next/link";

type Tab = { key: string; label: string };

const TABS: Tab[] = [
  { key: "overview", label: "Overview" },
  { key: "sessions", label: "Sessions" },
  { key: "health",   label: "Health" },
  { key: "goals",    label: "Goals" },
  { key: "media",    label: "Media" },
];

export function HorseProfileTabs({
  activeTab,
  horseId,
}: {
  activeTab: string;
  horseId: string;
}) {
  return (
    <nav
      aria-label="Horse profile sections"
      className="flex items-center gap-1 -mb-1 overflow-x-auto"
    >
      {TABS.map((t) => {
        const isActive = t.key === activeTab;
        const href =
          t.key === "overview"
            ? `/dashboard/horses/${horseId}`
            : `/dashboard/horses/${horseId}?tab=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
            scroll={false}
            className={`
              px-3.5 py-2 rounded-full text-[13px] transition-colors whitespace-nowrap
              ${isActive
                ? "bg-ink-900 text-white font-medium"
                : "text-ink-600 hover:text-ink-900 hover:bg-ink-100/60"
              }
            `}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
