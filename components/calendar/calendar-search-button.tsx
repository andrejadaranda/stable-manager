"use client";

// A search affordance that lives ON the calendar (next to the Week/Month
// toggle) so finding a lesson by rider/horse keyword is one tap away without
// hunting for the ⌘K palette in the sidebar. It just opens the existing global
// command palette (which already searches horses, clients AND lessons and
// jumps you to that day) via the shared custom event it listens for.

export function CalendarSearchButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("longrein:open-search"))}
      className="h-9 px-3.5 inline-flex items-center gap-2 rounded-xl text-[13px] font-medium text-ink-600 bg-ink-50 hover:bg-ink-100 transition-colors"
      aria-label="Search lessons, riders and horses"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Search
    </button>
  );
}
