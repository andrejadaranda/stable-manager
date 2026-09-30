"use client";

// A drop-in searchable picker — behaves like a <select> but, for long lists
// (clients, children), opens a dropdown with a type-to-filter box so the owner
// stops scrolling to find a name. Submits via a hidden input so it works inside
// plain <form action> server actions exactly like a native select would.
//
// Small lists (< searchThreshold options) still get the filter box only when it
// helps; the default threshold is 8 so a 3-trainer stable sees no extra clutter.

import { useEffect, useMemo, useRef, useState } from "react";

export type SearchOption = { id: string; label: string };

export function SearchableSelect({
  label,
  name,
  required,
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  searchThreshold = 8,
}: {
  label?: string;
  name?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: SearchOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  searchThreshold?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;
  const showSearch = options.length >= searchThreshold;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Focus the search box when opening.
  useEffect(() => {
    if (open && showSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open, showSearch]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm" ref={rootRef}>
      {label && (
        <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">{label}</span>
      )}
      {name && <input type="hidden" name={name} value={value} required={required} />}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="
            w-full text-left flex items-center justify-between gap-2
            rounded-xl border border-ink-200 bg-white text-sm px-3 py-2.5
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={selected ? "text-ink-900 truncate" : "text-ink-400 truncate"}>
            {selected ? selected.label : placeholder}
          </span>
          <span className="text-ink-400 shrink-0" aria-hidden>▾</span>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-ink-200 bg-white shadow-lift overflow-hidden">
            {showSearch && (
              <div className="p-2 border-b border-ink-100">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (filtered[0]) pick(filtered[0].id);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setOpen(false);
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="
                    w-full rounded-lg border border-ink-200 bg-white text-sm text-ink-900
                    placeholder:text-ink-400 px-2.5 py-1.5
                    focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                  "
                />
              </div>
            )}
            <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-[13px] text-ink-400">No matches</li>
              ) : (
                filtered.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => pick(o.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 ${
                        o.id === value ? "bg-brand-50/60 text-brand-800 font-medium" : "text-ink-800"
                      }`}
                    >
                      {o.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
