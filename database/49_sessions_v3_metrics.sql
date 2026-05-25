-- =============================================================
-- 49_sessions_v3_metrics.sql
-- SESSIONS V3 Tier 2 — elevation, calories, per-km splits.
-- Already applied via Supabase MCP; this file is the source-of-truth
-- copy committed for parity with the install.sql convention.
-- =============================================================

alter table sessions
  add column if not exists elevation_loss_m  integer,
  add column if not exists kcal_estimate     integer,
  add column if not exists splits_km         jsonb;

comment on column sessions.elevation_loss_m is
  'Total cumulative descent in meters during the ride.';
comment on column sessions.kcal_estimate is
  'Rough rider calories: METs × mass_kg × hours. Default mass 65kg.';
comment on column sessions.splits_km is
  'Per-km splits jsonb: [{km, pace_min_per_km, avg_kmh, elev_gain_m, elev_loss_m}]';
