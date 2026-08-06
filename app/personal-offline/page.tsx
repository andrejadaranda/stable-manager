// Offline fallback for the /personal command centre, pre-cached by
// sw-personal.js at install time.
//
// It lives OUTSIDE app/personal on purpose. Anything under app/personal
// inherits that segment's layout, which runs the allowlist gate and
// calls notFound() — so an offline page placed there would 404 at
// exactly the moment it is supposed to appear. It also must not depend
// on any fetch: it is served precisely when the network is gone.
//
// Nothing private is on this page, so serving it ungated is fine.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nėra ryšio",
  robots: { index: false, follow: false },
};

export default function PersonalOffline() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          className="h-7 w-7 text-brand-700"
          aria-hidden
        >
          <path d="M1 1l22 22M16.7 16.7A6 6 0 0 0 12 15a6 6 0 0 0-4.7 1.7M5 12.6a10 10 0 0 1 3-2M19 12.6a10 10 0 0 0-4.6-2.5M2 8.8A15 15 0 0 1 7 6M22 8.8a15 15 0 0 0-9.9-3M12 20h.01" />
        </svg>
      </div>
      <h1 className="font-display text-xl text-brand-700">Nėra ryšio</h1>
      <p className="mt-2 max-w-[30ch] text-sm leading-relaxed text-ink-500">
        Lenta rodo gyvus duomenis, tad be interneto nieko naujo parodyti
        negaliu. Prisijunk ir atnaujink.
      </p>
    </main>
  );
}
