"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn } from "./cn";

/**
 * URL-driven flash toast.
 *
 * Server actions append `?ok=Saved` or `?err=Something went wrong` to the
 * redirect URL; this component reads those params, renders a toast, then
 * strips them from the URL after a few seconds.
 *
 * Why URL-driven (not React state):
 *  - Server Components can't share state with client.
 *  - This pattern works after Server Action redirects (most of our writes).
 *  - No global store needed.
 */
export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ok = params.get("ok");
  const err = params.get("err");

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ok && !err) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      // Clean URL so refresh doesn't replay the toast.
      const cleaned = new URLSearchParams(params.toString());
      cleaned.delete("ok");
      cleaned.delete("err");
      const qs = cleaned.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 3500);
    return () => clearTimeout(t);
  }, [ok, err, params, pathname, router]);

  if (!visible || (!ok && !err)) return null;

  const tone: "success" | "error" = ok ? "success" : "error";
  const message = ok ?? err ?? "";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-6 z-50 flex justify-center pointer-events-none px-4"
    >
      <div
        className={cn(
          "toast-enter pointer-events-auto inline-flex items-center gap-3",
          "max-w-md text-sm font-medium px-4 py-3 rounded-xl shadow-lift",
          tone === "success"
            ? "bg-ink-900 text-white"
            : "bg-rose-600 text-white",
        )}
      >
        <Glyph kind={tone} />
        <span>{message}</span>
      </div>
    </div>
  );
}

function Glyph({ kind }: { kind: "success" | "error" }) {
  if (kind === "success") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="7" fill="rgba(255,255,255,0.18)" />
        <path
          d="M5 8.5l2 2 4-4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="rgba(255,255,255,0.18)" />
      <path
        d="M8 4.5v4M8 11h.01"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
