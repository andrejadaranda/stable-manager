"use client";

// "?" help icon — drops in next to any title to surface contextual
// help without a separate doc page. Click toggles a small popover
// with the body text.
//
// Used as: <HelpHint title="Welfare board" body="What this page shows…" />

import { useEffect, useRef, useState } from "react";

export function HelpHint({
  title,
  body,
  className,
}: {
  title: string;
  body: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Help about ${title}`}
        aria-expanded={open}
        className="
          w-6 h-6 rounded-full inline-flex items-center justify-center
          bg-ink-100 text-ink-600 hover:bg-brand-50 hover:text-brand-700
          text-[12px] font-semibold transition-colors
        "
      >
        ?
      </button>
      {open && (
        <div
          role="dialog"
          className="
            absolute right-0 top-full mt-2 z-30
            w-80 max-w-[calc(100vw-2rem)]
            bg-white rounded-xl shadow-lift ring-1 ring-ink-100
            p-4 text-left
          "
        >
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-brand-700 mb-1.5">
            {title}
          </p>
          <div className="text-[12.5px] text-ink-700 leading-relaxed space-y-2">
            {body}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 text-[11.5px] text-ink-500 hover:text-ink-900"
          >
            Got it →
          </button>
        </div>
      )}
    </div>
  );
}
