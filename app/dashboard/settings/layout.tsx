import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";

const TABS = [
  { href: "/dashboard/settings/stable",   label: "Stable",   ownerOnly: true  },
  { href: "/dashboard/settings/services", label: "Services", ownerOnly: true  },
  { href: "/dashboard/settings/boarding", label: "Boarding", ownerOnly: true  },
  { href: "/dashboard/settings/profile",  label: "Profile",  ownerOnly: false },
  { href: "/dashboard/settings/security", label: "Security", ownerOnly: false },
  { href: "/dashboard/settings/billing",  label: "Billing",  ownerOnly: true  },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePageRole("owner", "employee", "client");
  const visible = TABS.filter((t) => !t.ownerOnly || session.role === "owner");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 mb-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tightest text-ink-900">
          Settings
        </h1>
        <p className="text-sm text-ink-500">
          Manage your stable, account, and billing.
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        <nav className="md:w-56 shrink-0">
          <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {visible.map((t) => (
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
        </nav>

        <div className="flex-1 min-w-0 max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
