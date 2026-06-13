// Pure types for guest-contributor tokens — safe for client components.
// services/guestContributors.ts re-exports these for server callers.

export type GuestContributorKind = "vet" | "farrier" | "rider";

export type GuestContributorToken = {
  id:               string;
  horse_id:         string;
  token:            string;
  kind:             GuestContributorKind;
  contributor_name: string;
  expires_at:       string;
  revoked_at:       string | null;
  last_used_at:     string | null;
  use_count:        number;
  created_at:       string;
};

export const KIND_LABEL: Record<GuestContributorKind, string> = {
  vet:     "Vet",
  farrier: "Farrier",
  rider:   "Rider",
};
