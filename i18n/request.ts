import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, isLocale, type Locale } from "./config";

// Resolves the locale for every server render, and loads its messages.
//
// Order of preference:
//   1. The NEXT_LOCALE cookie — an explicit choice the user made, and the
//      only signal that should ever override the others.
//   2. Accept-Language — a reasonable guess for a first-time visitor.
//   3. English.
//
// Note this runs per request and is therefore uncached by design; the
// messages themselves are static imports, so the only per-request work is
// reading two headers.

async function resolveLocale(): Promise<Locale> {
  const fromCookie = cookies().get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  // Accept-Language looks like "lt-LT,lt;q=0.9,en-US;q=0.8". We only care
  // about the base language of each entry, in the order given — q-values
  // are already reflected in that order in every browser that matters.
  const accept = headers().get("accept-language");
  if (accept) {
    for (const part of accept.split(",")) {
      const base = part.trim().split(";")[0]?.split("-")[0]?.toLowerCase();
      if (isLocale(base)) return base;
    }
  }

  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,

    // Everything money- and date-shaped in Longrein is European: euros,
    // 24-hour clocks, Monday-first weeks. Pinning the time zone stops
    // server and client disagreeing about which day a 23:00 lesson is on,
    // which is the classic hydration-mismatch bug in a booking app.
    timeZone: "Europe/Vilnius",
  };
});

export { LOCALES };
