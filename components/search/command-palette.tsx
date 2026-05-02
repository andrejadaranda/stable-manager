"use client";

// Cmd+K (Ctrl+K on Windows) global search palette. Sits in the
// dashboard layout — wakes on shortcut or sidebar Search button,
// debounces input, fetches /api/search?q=…, renders grouped results.
//
// Keyboard: ↑/↓ moves selection, Enter navigates, Esc closes.
// Mobile: full-height bottom sheet so the on-screen keyboard
// doesn't squash the result list.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Hit = {
  id:        string;
  kind:      "horse" | "client" | "lesson";
  title:     string;
  subtitle:  string | null;
  href:      string;
};

const KIND_LABEL: Record<Hit["kind"], string> = {
  horse:  "Horse",
  client: "Client",
  lesson: "Lesson",
};

const KIND_TONE: Record<Hit["kind"], string> = {
  horse:  "bg-brand-50 text-brand-700",
  client: "bg-navy-50 text-navy-800",
  lesson: "bg-emerald-50 text-emerald-800",
};

export function CommandPalette() {
  const [open, setOpen]   = useState(false);
  const [q, setQ]         = useState("");
  const [hits, setHits]   = useState<Hit[]>([]);
  const [busy, setBusy]   = useState(false);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isShortcut) { e.preventDefault(); setOpen((v) => !v); }
      // Listen for the synthetic event the sidebar fires
    }
    function onCustom() { setOpen(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("hoofbeat:open-search", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hoofbeat:open-search", onCustom);
    };
  }, []);

  // Reset + focus on open
  useEffect(() => {
    if (open) {
      setQ(""); setHits([]); setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(t);
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (trimmed.length < 2) { setHits([]); return; }
    setBusy(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal });
        const data = (await r.json()) as { hits: Hit[] };
        setHits(data.hits ?? []);
        setActive(0);
      } catch {
        /* swallow aborts */
      } finally {
        setBusy(false);
      }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, open]);

  // List nav
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); }
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      if (e.key === "Enter" && hits[active]) {
        e.preventDefault();
        router.push(hits[active].href);
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hits, active, router]);

  if (!open) return null;

  // Group hits by kind, preserving server order within each group.
  const groups: Record<Hit["kind"], Hit[]> = { horse: [], client: [], lesson: [] };
  for (const h of hits) groups[h.kind].push(h);

  // Flat list so keyboard nav matches visible order.
  const ordered: Hit[] = [...groups.horse, ...groups.client, ...groups.lesson];

  return (
    <div
      className="fixed inset-0 z-50 flex md:items-start items-end md:justify-center bg-navy-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={() => setOpen(false)}
    >
      <div
        className="
          bg-white shadow-lift overflow-hidden flex flex-col
          w-full md:max-w-xl md:mt-24 md:rounded-2xl
          max-h-[80vh] md:max-h-[60vh]
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-ink-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-ink-400">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search horses, clients, lessons…"
            inputMode="search"
            className="
              flex-1 bg-transparent outline-none text-base text-ink-900
              placeholder:text-ink-400
            "
          />
          <kbd className="hidden md:inline-flex items-center px-1.5 h-6 rounded border border-ink-200 text-[10px] font-medium text-ink-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {q.trim().length < 2 ? (
            <div className="px-5 py-10 text-center text-[12.5px] text-ink-500">
              Type at least 2 characters to search.
              <p className="mt-2">Tip: Cmd+K (or Ctrl+K) opens this from anywhere.</p>
            </div>
          ) : busy && ordered.length === 0 ? (
            <div className="px-5 py-10 text-center text-[12.5px] text-ink-500">Searching…</div>
          ) : ordered.length === 0 ? (
            <div className="px-5 py-10 text-center text-[12.5px] text-ink-500">
              No matches for <span className="font-medium text-ink-700">"{q.trim()}"</span>.
            </div>
          ) : (
            <ul className="py-2">
              {(["horse", "client", "lesson"] as Hit["kind"][]).map((kind) => {
                const items = groups[kind];
                if (items.length === 0) return null;
                return (
                  <li key={kind}>
                    <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-400">
                      {KIND_LABEL[kind]}{items.length > 1 ? "s" : ""}
                    </p>
                    <ul>
                      {items.map((h) => {
                        const idx = ordered.indexOf(h);
                        const isActive = idx === active;
                        return (
                          <li key={h.id}>
                            <button
                              type="button"
                              onMouseEnter={() => setActive(idx)}
                              onClick={() => { router.push(h.href); setOpen(false); }}
                              className={`
                                w-full text-left px-4 py-2.5 flex items-center gap-3
                                ${isActive ? "bg-brand-50" : "hover:bg-ink-50"}
                                transition-colors
                              `}
                            >
                              <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${KIND_TONE[h.kind]}`}>
                                {KIND_LABEL[h.kind]}
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-medium text-navy-900 truncate">{h.title}</span>
                                {h.subtitle && (
                                  <span className="block text-[11.5px] text-ink-500 truncate">{h.subtitle}</span>
                                )}
                              </span>
                              {isActive && (
                                <kbd className="hidden md:inline-flex items-center px-1.5 h-5 rounded border border-ink-200 text-[10px] text-ink-500">↵</kbd>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
