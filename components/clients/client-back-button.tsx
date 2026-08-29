"use client";

// Small "Back" control for the client profile. Uses browser history so
// tapping it returns exactly where the owner came from — usually the
// calendar lesson they opened this client from. Falls back to the clients
// list if there's no history (e.g. the profile was opened via a direct link).

import { useRouter } from "next/navigation";

export function ClientBackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push("/dashboard/clients");
      }}
      className="inline-flex items-center gap-1.5 h-9 px-3 -ml-1 rounded-xl text-[13px] font-medium text-ink-600 hover:text-navy-900 hover:bg-ink-100/60 transition-colors"
    >
      <span aria-hidden className="text-base leading-none">←</span> Back
    </button>
  );
}
