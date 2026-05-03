// Longrein. brand mark — single source of truth for the in-app logo.
//
// Why a shared component instead of `<img src="/brand/...">`:
// the wordmark SVG file references Source Serif 4 via Google Fonts
// `@import` inside the SVG. Browsers BLOCK external resources when an
// SVG is loaded through `<img src>`, so the font wouldn't render and
// you'd get a fallback serif. Inlining the mark + relying on the
// page's already-loaded font (`font-display` Tailwind class === Source
// Serif 4) sidesteps that entirely.
//
// Two pieces:
//   <BrandIcon />     — the L. tile (rounded Paddock-Green square +
//                       cream "L" + Saddle-Tan period dot). The actual
//                       app icon, scaled down.
//   <Wordmark />      — "Longrein." set in Source Serif 4 via the
//                       page's font-display Tailwind utility.
//
// Default export <Logo /> = icon + wordmark, the lockup used in
// auth / legal / dashboard headers.

import Link from "next/link";

type Size = "sm" | "md" | "lg";

const ICON_PX:    Record<Size, number> = { sm: 24, md: 32, lg: 40 };
const TEXT_CLASS: Record<Size, string> = {
  sm: "text-base",
  md: "text-[19px]",
  lg: "text-[22px]",
};

/**
 * Just the rounded green tile with the cream "L" and Saddle-Tan period.
 * Use when space is tight (collapsed sidebar, mobile chrome) or for an
 * avatar-style mark.
 */
export function BrandIcon({
  size = "md",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  const px = ICON_PX[size];
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center shadow-sm ${className}`}
      style={{
        width:        px,
        height:       px,
        // Match the SVG master: 228/1024 ≈ 22% corner radius.
        borderRadius: Math.round(px * 0.22),
        background:   "#1E3A2A", // Paddock Green
      }}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 1024 1024"
        role="img"
        aria-label="Longrein."
      >
        <text
          x="430"
          y="750"
          textAnchor="middle"
          fill="#F4ECDF" /* Arena Cream */
          style={{
            fontFamily:   "'Source Serif 4','Source Serif Pro',Georgia,serif",
            fontWeight:   500,
            fontSize:     "700px",
          }}
        >
          L
        </text>
        {/* Saddle-Tan period — the brand mark. */}
        <circle cx="730" cy="715" r="48" fill="#B5793E" />
      </svg>
    </span>
  );
}

/**
 * "Longrein." typeset in Source Serif 4. Relies on the page's already-
 * loaded `font-display` family so the period stays the brand period.
 */
export function Wordmark({
  size = "md",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  return (
    <span
      className={`text-navy-900 leading-none font-display ${TEXT_CLASS[size]} ${className}`}
      style={{ letterSpacing: "-0.015em" }}
    >
      Longrein<span className="text-brand-600">.</span>
    </span>
  );
}

/**
 * Icon + wordmark lockup. Wrap in <Link href="/"> at the call-site if
 * you want it clickable, or use <LinkedLogo /> for the common case.
 */
export function Logo({
  size = "md",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandIcon size={size} />
      <Wordmark size={size} />
    </span>
  );
}

/**
 * Logo wrapped in a Next.js <Link> back to "/". Used in auth/legal/
 * dashboard chrome. Hover scales the icon tile slightly.
 */
export function LinkedLogo({
  size = "md",
  href = "/",
  className = "",
}: {
  size?: Size;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 group ${className}`}
    >
      <BrandIcon
        size={size}
        className="group-hover:scale-105 transition-transform"
      />
      <Wordmark size={size} />
    </Link>
  );
}
