"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";
import type { Role } from "@/lib/auth/session";

type Item = { href: string; label: string };

const NAV: Record<Role, Item[]> = {
  owner: [
    { href: "/dashboard/calendar", label: "Calendar" },
    { href: "/dashboard/horses",   label: "Horses" },
    { href: "/dashboard/clients",  label: "Clients" },
    { href: "/dashboard/payments", label: "Payments" },
    { href: "/dashboard/expenses", label: "Expenses" },
    { href: "/dashboard/team",     label: "Team" },
  ],
  employee: [
    { href: "/dashboard/calendar", label: "Calendar" },
    { href: "/dashboard/horses",   label: "Horses" },
    { href: "/dashboard/clients",  label: "Clients" },
  ],
  client: [
    { href: "/dashboard/my-lessons",  label: "My Lessons" },
    { href: "/dashboard/my-payments", label: "My Payments" },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  employee: "Employee",
  client: "Client",
};

export function Sidebar({ role, email }: { role: Role; email: string }) {
  const pathname = usePathname();
  return (
    <aside className="w-60 border-r border-neutral-200 bg-white flex flex-col">
      <div className="px-5 py-5 border-b border-neutral-200">
        <p className="text-sm font-medium text-neutral-900 truncate">{email}</p>
        <p className="text-[11px] uppercase tracking-wider text-neutral-500 mt-1">
          {ROLE_LABEL[role]}
        </p>
      </div>
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        {NAV[role].map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-neutral-900 text-white font-medium"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form action={logoutAction} className="p-2 border-t border-neutral-200">
        <button
          type="submit"
          className="w-full text-left px-3 py-2 rounded-md text-sm text-neutral-600 hover:bg-neutral-100 transition-colors"
        >
          Sign out
        </button>
      </form>
    </aside>
  );
}
