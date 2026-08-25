// Locale configuration.
//
// Deliberately NO locale prefix in URLs — no /en/dashboard, no /lt/login.
// next-intl's documented default is prefixed routing, and it was the
// wrong fit here for four concrete reasons:
//
//   1. Every one of the 85 pages would have to move under app/[locale]/.
//   2. The SEO rules in next.config.js match on path prefixes
//      ("signup|login|s/|legal/|guest/"). A locale segment breaks all of
//      them, silently, in a way no build catches.
//   3. middleware.ts gates on path.startsWith("/dashboard"). Same problem,
//      except this one is an auth bypass rather than a ranking bug.
//   4. Share links already in customers' inboxes — /s/[slug],
//      /invite/[token], /live/[token] — would 404.
//
// Instead the locale lives in a cookie and is resolved server-side. The
// cost is that a page can't be linked in a specific language, which for a
// logged-in stable-management app is not something anyone needs.

export const LOCALES = ["en", "lt"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Read and written by the language switcher. Named to match Next.js's own
// convention so it looks familiar even though we don't use built-in i18n
// routing.
export const LOCALE_COOKIE = "NEXT_LOCALE";

// Shown in the language switcher. Each language is written in itself —
// a Lithuanian speaker looking for their language scans for "Lietuvių",
// not for "Lithuanian".
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  lt: "Lietuvių",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
