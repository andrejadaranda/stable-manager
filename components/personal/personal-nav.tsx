"use client";

// Bottom tab bar for the command centre.
//
// Six destinations is more than the three-to-five a consumer app would
// use, but this is a cockpit — she asked to reach every area in one tap
// rather than behind a "More" sheet.
//
// Seven is the hard ceiling. On an iPhone 15 Pro (393pt) that is ~56pt
// per tab, which fits a 21px icon and a 9.5px label only because the
// labels are short. An eighth tab, or a label longer than "Rinkodara",
// would start truncating — at that point the honest move is a "More"
// sheet, not a smaller font.
//
// Labels are Lithuanian: she wrote the brief in Lithuanian and this is
// hers alone, so there is nothing to internationalise.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

// 20px stroke icons, drawn inline so the app has zero icon-font or
// sprite dependency and works offline from the first paint.
const I = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[21px] w-[21px]"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const TABS: Tab[] = [
  {
    href: "/personal",
    label: "Šiandien",
    icon: <I d="M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />,
  },
  {
    href: "/personal/tjk",
    label: "TJK",
    icon: <I d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  },
  {
    href: "/personal/finansai",
    label: "Finansai",
    icon: <I d="M12 2v20M17 5.5C17 4.12 14.76 3 12 3S7 4.12 7 5.5 9.24 8 12 8s5 1.12 5 2.5-2.24 2.5-5 2.5-5 1.12-5 2.5S9.24 18 12 18s5-1.12 5-2.5" />,
  },
  {
    href: "/personal/longrein",
    label: "Longrein",
    icon: <I d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  },
  // The composer at /personal/social is deliberately NOT a tab. She said
  // plainly she does not want to publish from here — only to see the
  // numbers — and a tab for a feature she has decided against is six
  // wasted pixels on every screen. The route still works and is linked
  // from Rinkodara, so nothing was thrown away.
  {
    href: "/personal/marketing",
    label: "Rinkodara",
    icon: <I d="M3 11v3a1 1 0 0 0 1 1h3l4 4V6L7 10H4a1 1 0 0 0-1 1ZM16 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13" />,
  },
  {
    href: "/personal/tikslai",
    label: "Tikslai",
    icon: <I d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
  },
];

export function PersonalNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40",
        // Frosted bar. The safe-area padding keeps the labels above the
        // iPhone home indicator instead of under it.
        "border-t border-ink-200/60 bg-surface/85 backdrop-blur-xl",
        "pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5",
      )}
      aria-label="Pagrindinė navigacija"
    >
      <ul className="mx-auto flex max-w-[560px] items-stretch justify-between px-1">
        {TABS.map((tab) => {
          // Exact match for the index tab, prefix match for the rest —
          // otherwise "/personal" would light up on every screen.
          const active =
            tab.href === "/personal"
              ? pathname === "/personal"
              : pathname.startsWith(tab.href);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5",
                  "transition-colors duration-200 ease-soft",
                  active ? "text-brand-700" : "text-ink-400",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-full items-center justify-center rounded-lg",
                    "transition-all duration-300 ease-soft",
                    active && "bg-brand-100/70",
                  )}
                >
                  {tab.icon}
                </span>
                <span
                  className={cn(
                    "text-[9.5px] leading-none tracking-tight",
                    active ? "font-semibold" : "font-medium",
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
