"use client";

// Cookie consent banner — GDPR strict-by-default.
//
// Shows on first visit, dismisses on Accept or Reject. Choice persisted
// in localStorage as `longrein.consent.v1` = "accepted" | "rejected".
// On return visits, banner stays hidden. To reset choice, user can
// clear that key (instructions on /legal/cookies).
//
// Style: bottom slide-in, Cream background, Paddock primary, no
// orange "ACCEPT ALL" mega-button — intentionally calm and equal-weight
// between Accept and Reject so the strict-by-default posture shows
// through the visual design.

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "longrein.consent.v1";

type Choice = "accepted" | "rejected";

export function CookieBanner() {
  const [show, setShow]   = useState(false);
  const [closing, setClose] = useState(false);

  useEffect(() => {
    // Wait one tick so the slide-in animation can play after hydration.
    const t = setTimeout(() => {
      try {
        const v = window.localStorage.getItem(STORAGE_KEY);
        if (v !== "accepted" && v !== "rejected") {
          setShow(true);
        }
      } catch {
        // localStorage blocked — show banner; we won't be able to
        // remember the choice but at least the user is informed.
        setShow(true);
      }
    }, 200);
    return () => clearTimeout(t);
  }, []);

  function record(choice: Choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // ignore — best effort
    }
    setClose(true);
    // 280ms matches the leave transition below.
    setTimeout(() => setShow(false), 280);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className={`
        fixed bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-md
        z-50 transition-all duration-280 ease-out
        ${closing ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"}
      `}
    >
      <div
        className="
          bg-white rounded-2xl shadow-lift ring-1 ring-ink-100
          p-5 md:p-6 text-left
        "
        style={{ background: "#FBF6EE" /* Arena Cream variant */ }}
      >
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-brand-700 mb-2">
          Cookies
        </p>
        <p className="text-[13.5px] text-ink-800 leading-relaxed">
          We use only the cookies needed to keep you logged in and remember this choice.
          We do not run advertising or analytics trackers. See the{" "}
          <Link href="/legal/cookies" className="underline text-brand-700 hover:text-brand-900">
            Cookie Policy
          </Link>{" "}
          for the full list.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => record("accepted")}
            className="
              inline-flex items-center justify-center
              h-10 px-4 rounded-xl text-[13.5px] font-medium
              bg-brand-700 text-white hover:bg-brand-800
              transition-colors shadow-sm
            "
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => record("rejected")}
            className="
              inline-flex items-center justify-center
              h-10 px-4 rounded-xl text-[13.5px] font-medium
              bg-white text-ink-800 hover:bg-ink-100
              ring-1 ring-ink-200 transition-colors
            "
          >
            Reject non-essential
          </button>
        </div>
      </div>
    </div>
  );
}
