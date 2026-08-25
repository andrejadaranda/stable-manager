import { getLocale, getTranslations } from "next-intl/server";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

// Language switcher.
//
// A plain form with one submit button per language rather than a <select>
// with an onChange handler. That keeps this a server component — no
// client JS, nothing to hydrate — and it still works in the Capacitor
// WebView if scripts are slow to boot, which is the environment where a
// stuck language picker would be hardest to debug.

export async function LanguageSwitcher({ className }: { className?: string }) {
  const current = await getLocale();
  const t = await getTranslations("common");

  return (
    <form action={setLocale} className={className}>
      <fieldset className="flex items-center gap-1">
        <legend className="sr-only">{t("language")}</legend>
        {LOCALES.map((locale) => {
          const isCurrent = locale === current;
          return (
            <button
              key={locale}
              type="submit"
              name="locale"
              value={locale}
              aria-current={isCurrent ? "true" : undefined}
              className={
                isCurrent
                  ? "rounded-full px-2.5 py-1 text-xs font-semibold text-ink-900 bg-ink-100"
                  : "rounded-full px-2.5 py-1 text-xs font-medium text-ink-500 hover:text-ink-900"
              }
            >
              {LOCALE_LABELS[locale]}
            </button>
          );
        })}
      </fieldset>
    </form>
  );
}
