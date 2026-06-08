// Outstanding-balance types — safe to import from "use client" components.

export type OutstandingLine = {
  /** What the debt is for (e.g. "Boarding", "Farrier & vet", "Other charges"). */
  label: string;
  /** Amount still owed, in cents. */
  cents: number;
  /** Optional detail (e.g. "2 months", "3 visits"). */
  detail?: string;
};

export type HorseOutstanding = {
  total_cents: number;
  lines: OutstandingLine[];
};
