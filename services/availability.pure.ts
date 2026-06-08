// Block-out (time-off) types — safe to import from "use client" components.

export type AvailabilityBlock = {
  id: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  reason: string | null;
};
