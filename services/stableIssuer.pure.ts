// Runtime-free VAT helpers, safe to import from "use client" components
// (no supabase/server import). Server code re-exports these from stableIssuer.ts.

// Standard VAT rates by country (%), used to pre-fill vat_rate when a country is
// picked. The owner can still override the rate. 0 = none.
export const DEFAULT_VAT_BY_COUNTRY: Record<string, number> = {
  LT: 21, LV: 21, EE: 22, PL: 23, DE: 19, FI: 25.5, SE: 25, DK: 25,
  IE: 23, FR: 20, NL: 21, ES: 21, IT: 22, AT: 20, BE: 21, PT: 23,
  GB: 20, NO: 25, CZ: 21, SK: 23, HU: 27,
};

export const COUNTRY_LABELS: Record<string, string> = {
  LT: "Lithuania", LV: "Latvia", EE: "Estonia", PL: "Poland", DE: "Germany",
  FI: "Finland", SE: "Sweden", DK: "Denmark", IE: "Ireland", FR: "France",
  NL: "Netherlands", ES: "Spain", IT: "Italy", AT: "Austria", BE: "Belgium",
  PT: "Portugal", GB: "United Kingdom", NO: "Norway", CZ: "Czechia",
  SK: "Slovakia", HU: "Hungary",
};

export function defaultVatForCountry(country: string | null | undefined): number {
  if (!country) return 0;
  return DEFAULT_VAT_BY_COUNTRY[country.toUpperCase()] ?? 0;
}
