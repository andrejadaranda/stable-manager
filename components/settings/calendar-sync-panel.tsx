"use client";

// Calendar sync — shows the personal iCalendar subscription URL and a
// one-tap copy. Subscribe to it in Google Calendar / Apple Calendar and your
// Longrein lessons appear there automatically (and in TimeTree, which displays
// your Google/iCloud calendar). Read-only; updates every ~15 min.

import { useState } from "react";

export function CalendarSyncPanel({ feedUrl, webcalUrl }: { feedUrl: string; webcalUrl: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(feedUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => { /* clipboard blocked — user can select manually */ },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-serif font-semibold text-[22px] text-ink-900">Calendar sync</h2>
        <p className="text-[13.5px] text-ink-500 mt-1 leading-relaxed">
          Subscribe to your Longrein lessons in Google Calendar or Apple Calendar. New and changed
          lessons appear automatically (updates roughly every 15 minutes). Because TimeTree shows your
          Google / iCloud calendar, your lessons show up there too.
        </p>
      </div>

      {/* The URL */}
      <div className="bg-white border border-ink-100 rounded-2xl shadow-soft p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400 mb-2">Your private calendar link</div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={feedUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-ink-200 bg-ink-50 text-[13px] font-mono text-ink-800"
          />
          <button
            type="button"
            onClick={copy}
            className="h-11 px-4 rounded-xl bg-brand-700 text-white text-[13px] font-bold hover:bg-brand-800 transition-colors shrink-0"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <p className="text-[11.5px] text-ink-400 mt-2">
          Keep this link private — anyone with it can see your lesson times.
        </p>
      </div>

      {/* Quick add buttons */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://calendar.google.com/calendar/u/0/r/settings/addbyurl?cid=${encodeURIComponent(feedUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white border border-ink-200 text-[13px] font-semibold text-ink-800 hover:bg-ink-50"
        >
          Add to Google Calendar
        </a>
        <a
          href={webcalUrl}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white border border-ink-200 text-[13px] font-semibold text-ink-800 hover:bg-ink-50"
        >
          Add to Apple Calendar
        </a>
      </div>

      {/* How-to */}
      <div className="bg-ink-50 rounded-2xl p-4 text-[13px] text-ink-600 leading-relaxed">
        <p className="font-bold text-ink-800 mb-1.5">How to add it manually</p>
        <p className="mb-1"><b>Google Calendar (web):</b> Other calendars → + → From URL → paste the link.</p>
        <p className="mb-1"><b>iPhone:</b> Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste the link.</p>
        <p><b>TimeTree:</b> add your Google/iCloud account to your phone, then enable it in TimeTree — your lessons show through it.</p>
      </div>
    </div>
  );
}
