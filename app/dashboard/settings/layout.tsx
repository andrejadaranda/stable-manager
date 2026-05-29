// Settings layout — grouped sidebar nav.
// 5 logical groups make it discoverable as the surface grows.

import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { getStableFeatures, type FeatureKey } from "@/services/features";

type Tab = {
  href: string;
  label: string;
  ownerOnly: boolean;
  feature?: FeatureKey;
};

type Group = {
  title: string;
  tabs: Tab[];
};

const GROUPS: Group[] = [
  {
    title: "Personal",
    tabs: [
      { href: "/dashboard/settings/profile",  label: "Profile",  ownerOnly: false },
      { href: "/dashboard/settings/security", label: "Security", ownerOnly: false },
    ],
  },
  {
    title: "Stable",
    tabs: [
      { href: "/dashboard/settings/stable",   label: "Stable info", ownerOnly: true },
      { href: "/dashboard/settings/brand",    label: "Brand kit",   ownerOnly: true },
      { href: "/dashboard/settings/hours",    label: "Hours & holidays", ownerOnly: true },
    ],
  },
  {
    title: "Operations",
    tabs: [
      { href: "/dashboard/settings/services",      label: "Services", ownerOnly: true, feature: "services" },
      { href: "/dashboard/settings/boarding",      label: "Boarding", ownerOnly: true, feature: "boarding" },
      { href: "/dashboard/settings/session-types", label: "Session types", ownerOnly: true },
      { href: "/dashboard/settings/arenas",        label: "Arenas", ownerOnly: true },
      { href: "/dashboard/settings/weather",       label: "Weather alerts", ownerOnly: true },
      { href: "/dashboard/settings/features",      label: "Features", ownerOnly: true },
    ],
  },
  {
    title: "Billing",
    tabs: [
      { href: "/dashboard/settings/billing",  label: "Subscription", ownerOnly: true },
      { href: "/dashboard/settings/issuer",   label: "Issuer (invoices)", ownerOnly: true },
    ],
  },
  {
    title: "Advanced",
    tabs: [
      { href: "/dashboard/settings/import",   label: "Import", ownerOnly: true },
      { href: "/dashboard/settings/activity", label: "Activity log", ownerOnly: true },
    ],
  },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePageRole("owner", "employee", "client");
  const features = session.role === "owner" ? await getStableFeatures() : null;

  const visibleGroups: Group[] = GROUPS
    .map((g) => ({
      title: g.title,
      tabs: g.tabs.filter((t) => {
        if (t.ownerOnly && session.role !== "owner") return false;
        if (t.feature && features && !features[t.feature]) return false;
        return true;
      }),
    }))
    .filter((g) => g.tabs.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 mb-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tightest text-ink-900">
          Settings
        </h1>
        <p className="text-sm text-ink-500">
          Manage your stable, branding, operations, billing, and account.
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        <nav className="md:w-60 shrink-0">
          <div className="flex md:flex-col gap-4 overflow-x-auto md:overflow-visible">
            {visibleGroups.map((g) => (
              <div key={g.title} className="shrink-0 min-w-[200px] md:min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold px-3 mb-1.5">
                  {g.title}
                </div>
                <ul className="flex md:flex-col gap-1">
                  {g.tabs.map((t) => (
                    <li key={t.href} className="shrink-0">
                      <Link
                        href={t.href}
                        className="block px-3 py-2 rounded-lg text-sm text-ink-700 hover:text-ink-900 hover:bg-white/70 transition-colors data-[active=true]:bg-white data-[active=true]:text-ink-900 data-[active=true]:font-medium data-[active=true]:shadow-soft"
                      >
                        {t.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0 max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
