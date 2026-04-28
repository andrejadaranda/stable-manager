"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";
import type { Role } from "@/lib/auth/session";

type Item = { href: string; label: string; icon: React.ReactNode };

const NAV: Record<Role, Item[]> = {
  owner: [
    { href: "/dashboard",          label: "Overview", icon: <IconHome /> },
    { href: "/dashboard/calendar", label: "Calendar", icon: <IconCal />  },
    { href: "/dashboard/sessions", label: "Sessions", icon: <IconActivity /> },
    { href: "/dashboard/horses",   label: "Horses",   icon: <IconHorse /> },
    { href: "/dashboard/clients",  label: "Clients",  icon: <IconUsers /> },
    { href: "/dashboard/chat",     label: "Chat",     icon: <IconChat /> },
    { href: "/dashboard/payments", label: "Payments", icon: <IconCash /> },
    { href: "/dashboard/expenses", label: "Expenses", icon: <IconReceipt /> },
    { href: "/dashboard/team",     label: "Team",     icon: <IconShield /> },
  ],
  employee: [
    { href: "/dashboard",          label: "Overview", icon: <IconHome /> },
    { href: "/dashboard/calendar", label: "Calendar", icon: <IconCal />  },
    { href: "/dashboard/sessions", label: "Sessions", icon: <IconActivity /> },
    { href: "/dashboard/horses",   label: "Horses",   icon: <IconHorse /> },
    { href: "/dashboard/clients",  label: "Clients",  icon: <IconUsers /> },
    { href: "/dashboard/chat",     label: "Chat",     icon: <IconChat /> },
  ],
  client: [
    { href: "/dashboard/my-lessons",   label: "My Lessons",  icon: <IconCal />      },
    { href: "/dashboard/my-sessions",  label: "My Rides",    icon: <IconActivity /> },
    { href: "/dashboard/my-payments",  label: "My Payments", icon: <IconCash />     },
    { href: "/dashboard/chat",         label: "Chat",        icon: <IconChat />     },
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

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const initial = (email?.[0] || "?").toUpperCase();

  return (
    <>
      {/* MOBILE TOP BAR ----------------------------------------------- */}
      <div className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-surface/80 backdrop-blur-md border-b border-ink-200/60">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-1 -ml-1 rounded-lg text-ink-700 hover:bg-ink-100/60"
        >
          <Hamburger />
        </button>
        <Brand small />
        <Avatar initial={initial} small />
      </div>

      {/* BACKDROP ----------------------------------------------------- */}
      {open && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="md:hidden fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm"
        />
      )}

      {/* SIDEBAR ------------------------------------------------------ */}
      <aside
        className={`
          fixed md:sticky md:top-0 inset-y-0 left-0 z-40
          w-72 md:w-64 h-screen
          bg-surface/85 backdrop-blur-md md:bg-transparent
          border-r border-ink-200/50
          flex flex-col
          transform transition-transform duration-200 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        <div className="px-5 pt-6 pb-4 hidden md:flex items-center gap-2">
          <Brand />
        </div>

        <Link
          href="/dashboard/settings/profile"
          className="mx-3 mt-4 md:mt-2 mb-3 px-3 py-3 rounded-xl bg-white shadow-soft hover:shadow-lift transition-shadow flex items-center gap-3 group"
        >
          <Avatar initial={initial} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900 truncate">{email}</p>
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500 mt-0.5">
              {ROLE_LABEL[role]}
            </p>
          </div>
          <span className="text-ink-400 group-hover:text-brand-600 transition-colors text-sm">
            ⚙
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="md:hidden absolute top-4 right-4 text-ink-400 hover:text-ink-900 p-1"
        >
          ✕
        </button>

        <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto">
          {NAV[role].map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")) ||
              (item.href === "/dashboard" && pathname === "/dashboard");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-brand-600 text-white font-medium shadow-sm"
                    : "text-ink-700 hover:bg-white/70 hover:text-ink-900"
                }`}
              >
                <span
                  className={`shrink-0 transition-colors ${
                    isActive ? "text-white" : "text-ink-400 group-hover:text-ink-700"
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-ink-200/50 flex flex-col gap-1">
          {role === "owner" && (
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-ink-600 hover:bg-white/70 hover:text-ink-900 transition-colors"
            >
              <span className="text-ink-400"><IconCog /></span>
              Settings
            </Link>
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-ink-500 hover:bg-white/70 hover:text-ink-900 transition-colors"
            >
              <span className="text-ink-400"><IconExit /></span>
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function Brand({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className={`${small ? "w-6 h-6" : "w-8 h-8"} rounded-lg bg-brand-600 inline-flex items-center justify-center shadow-sm`}
      >
        <svg width={small ? 14 : 18} height={small ? 14 : 18} viewBox="0 0 24 24" fill="none">
          <path
            d="M5 18V8.5l5-3.5 5 3.5V18M9 18v-4h2v4"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={`font-semibold text-ink-900 tracking-tightest ${small ? "text-sm" : "text-base"}`}>
        Stable OS
      </span>
    </div>
  );
}

function Avatar({ initial, small }: { initial: string; small?: boolean }) {
  const size = small ? "w-8 h-8 text-sm" : "w-9 h-9 text-sm";
  return (
    <span
      aria-hidden
      className={`${size} shrink-0 inline-flex items-center justify-center rounded-full bg-ink-900 text-white font-semibold`}
    >
      {initial}
    </span>
  );
}

function Hamburger() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

/* ------- nav glyphs (kept simple to avoid icon-lib dependency) ------- */
function IconHome() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>;
}
function IconCal() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>;
}
function IconHorse() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19c0-3 2-5 5-5h4l3-3 2 1-1 3-2 1v3"/><path d="M5 19h13"/><path d="M9 8l-2-2 2-2 2 2"/></svg>;
}
function IconUsers() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M21 19c0-2-1.5-4-4-4"/></svg>;
}
function IconCash() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>;
}
function IconReceipt() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h14v18l-3-2-3 2-2-2-3 2-3-2z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>;
}
function IconShield() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>;
}
function IconCog() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>;
}
function IconExit() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>;
}
function IconChat() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-4 3z"/></svg>;
}
function IconActivity() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>;
}
