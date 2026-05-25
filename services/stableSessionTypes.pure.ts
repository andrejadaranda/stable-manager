// Pure types for stableSessionTypes.
// Safe to import from client components.

export type StableSessionType = {
  id:         string;
  label:      string;
  color:      string | null;
  sort_order: number;
  active:     boolean;
};
