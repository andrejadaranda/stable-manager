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
        <>
          {/* Mobile: full-width bottom sheet + backdrop. The previous
             absolutely-positioned popover overflowed off the left edge
             of the viewport whenever the "?" sat near the left margin
             (which is most page headings on mobile). Bottom sheet
             sidesteps all anchoring math and matches native mobile UX. */}
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            className="
              md:hidden fixed z-40
              left-0 right-0 bottom-0
              bg-white rounded-t-2xl shadow-lift ring-1 ring-ink-100
              p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]
              max-h-[80vh] overflow-y-auto
              text-left
            "
          >
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-brand-700 mb-1.5">
              {title}
            </p>
            <div className="text-[13px] text-ink-700 leading-relaxed space-y-2">
              {body}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl bg-brand-700 hover:bg-brand-600 text-white text-sm font-medium py-2.5"
            >
              Got it
            </button>
          </div>

          {/* Desktop: inline popover anchored to the trigger as before. */}
          <div
            role="dialog"
            className="
              hidden md:block
              absolute top-full mt-2 z-30
              left-auto right-0
              w-80
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
        </>
      )}
    </div>
  );
}
