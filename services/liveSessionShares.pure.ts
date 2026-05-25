// Pure types for live-session shares (beacon links).
// services/liveSessionShares.ts re-exports these for server callers.

export type LiveSessionShare = {
  id:             string;
  session_id:     string;
  token:          string;
  expires_at:     string;
  revoked_at:     string | null;
  created_at:     string;
  view_count:     number;
  last_viewed_at: string | null;
};

/** A point as returned by the resolve/poll RPCs. Lat/lng come back as
 *  numeric strings from PostgREST — we coerce on the client. */
export type BeaconPoint = {
  lat: number | string;
  lng: number | string;
  spd: number | string | null;
  at:  string;
};

export type BeaconBootstrap = {
  ok:           true;
  session_id:   string;
  horse_name:   string | null;
  stable_name:  string | null;
  status:       "live" | "completed" | "abandoned";
  started_at:   string;
  finished_at:  string | null;
  expires_at:   string;
  points:       BeaconPoint[];
};
