"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);

  // Close drawer on every route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer open (mobile only).
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const initial = (email?.[0] || "?").toUpperCase();

  return (
    <>
      {/* MOBILE TOP BAR ----------------------------------------------- */}
      <div className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur border-b border-neutral-200/70">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-1 -ml-1 rounded-lg text-neutral-700 hover:bg-neutral-100"
        >
          <Hamburger />
        </button>
        <span className="text-sm font-semibold text-neutral-900">
          Stable Manager
        </span>
        <Avatar initial={initial} small />
      </div>

      {/* BACKDROP ----------------------------------------------------- */}
      {open && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="md:hidden fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
        />
      )}

      {/* SIDEBAR ------------------------------------------------------ */}
      <aside
        className={`
          fixed md:sticky md:top-0 inset-y-0 left-0 z-40
          w-72 md:w-64 h-screen
          bg-white/70 backdrop-blur md:bg-transparent
          border-r border-neutral-200/60
          flex flex-col
          transform transition-transform duration-200 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        <div className="px-5 pt-6 pb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar initial={initial} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">
                {email}
              </p>
              <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mt-0.5">
                {ROLE_LABEL[role]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="md:hidden text-neutral-400 hover:text-neutral-900 -mr-1 p-1"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto">
          {NAV[role].map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-neutral-900 text-white font-medium"
                    : "text-neutral-700 hover:bg-white/80 hover:text-neutral-900"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? "bg-white" : "bg-neutral-300 group-hover:bg-neutral-500"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <form action={logoutAction} className="p-3">
          <button
            type="submit"
            className="w-full text-left px-3 py-2 rounded-xl text-sm text-neutral-500 hover:bg-white/80 hover:text-neutral-900 transition-colors"
          >
            Sign out
          </button>
        </form>
      </aside>
    </>
  );
}

function Avatar({ initial, small }: { initial: string; small?: boolean }) {
  const size = small ? "w-8 h-8 text-sm" : "w-10 h-10 text-base";
  return (
    <span
      aria-hidden
      className={`${size} shrink-0 inline-flex items-center justify-center rounded-full bg-neutral-900 text-white font-semibold`}
    >
      {initial}
    </span>
  );
}

function Hamburger() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}
