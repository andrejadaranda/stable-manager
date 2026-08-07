"use client";

// Error boundary for the command centre.
//
// Two jobs: keep her inside the app when a screen throws (a "try again"
// button beats a browser error page on a phone at the yard), and feed the
// error-rate card so the Longrein screen has a real number behind it.

import { useEffect } from "react";
import { reportClientError } from "@/app/personal/report-error";

export default function PersonalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportClientError({
      scope: "personal",
      route: typeof window !== "undefined" ? window.location.pathname : "/personal",
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-surface-muted/40 px-5 py-10 text-center">
      <p className="text-[14px] font-medium text-ink-800">Kažkas nepavyko</p>
      <p className="mx-auto mt-2 max-w-[32ch] text-[12.5px] leading-relaxed text-ink-500">
        Šis ekranas nenusiskaitė. Klaida užfiksuota — pabandyk dar kartą.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-full bg-brand-600 px-4 py-2 text-[12.5px] font-semibold text-white active:bg-brand-700"
      >
        Bandyti dar kartą
      </button>
      {error.digest && (
        <p className="mt-3 text-[10.5px] text-ink-400">Nr. {error.digest}</p>
      )}
    </div>
  );
}
