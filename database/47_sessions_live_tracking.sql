-- =============================================================
-- 47_sessions_live_tracking.sql
-- SESSIONS V2 — Strava-for-equestrian live tracking.
--
-- Adds:
--   1. session_type enum values missing in DB (dressage, cross_country,
--      western, vaulting, rehab) — already exist in TS, sync now.
--   2. session_status enum (live | completed | abandoned).
--   3. sessions.* analytics columns: distance_m, durations,
--      avg/max speed, encoded polyline, gait breakdown JSONB,
--      device meta, finished_at.
--   4. session_tracks table for raw GPS points (one row per point,
--      batched inserts every ~10s during a live ride).
--   5. RLS mirroring sessions_policies.sql.
--
-- Conventions follow 02_schema.sql + 12_sessions.sql:
--   - tenant root: stable_id (sessions) — tracks inherit via FK
--   - same-stable validation by inheritance from sessions
--   - set_updated_at trigger reused
-- =============================================================

-- ---------------- ENUM EXTENSIONS ----------------
-- session_type currently has: flat, jumping, lunging, groundwork, hack, other.
-- TS code already references: dressage, cross_country, western, vaulting, rehab.
-- Add the missing values. (ALTER TYPE ADD VALUE must run outside a transaction
-- block in older PG, but Supabase 15+ handles this fine in a migration.)
alter type session_type add value if not exists 'dressage';
alter type session_type add value if not exists 'cross_country';
alter type session_type add value if not exists 'western';
alter type session_type add value if not exists 'vaulting';
alter type session_type add value if not exists 'rehab';

-- ---------------- session_status ENUM ----------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'session_status') then
    create type session_status as enum ('live', 'completed', 'abandoned');
  end if;
end $$;

-- ---------------- SESSIONS — analytics columns ----------------
alter table sessions
  add column if not exists status            session_status not null default 'completed',
  add column if not exists finished_at       timestamptz,
  add column if not exists distance_m        integer        not null default 0,
  add column if not exists moving_seconds    integer        not null default 0,
  add column if not exists elapsed_seconds   integer        not null default 0,
  add column if not exists avg_speed_kmh     numeric(5,2),
  add column if not exists max_speed_kmh     numeric(5,2),
  add column if not exists elevation_gain_m  integer,
  add column if not exists encoded_polyline  text,
  add column if not exists gait_breakdown    jsonb,   -- {walk_s, trot_s, canter_s, gallop_s}
  add column if not exists tracking_device   text,    -- 'web-pwa' | 'ios-native' | 'manual'
  add column if not exists tracking_points   integer  not null default 0;

comment on column sessions.status            is 'live = currently being tracked, completed = finished + finalized, abandoned = user quit without saving';
comment on column sessions.encoded_polyline  is 'Google-format encoded polyline of the route for fast map rendering without loading raw points.';
comment on column sessions.gait_breakdown    is 'Seconds-per-gait derived from speed buckets: walk <7kmh, trot 7-17, canter 17-30, gallop 30+.';
comment on column sessions.tracking_device   is 'How the data was captured. web-pwa = browser geolocation foreground only.';

-- duration_minutes existed before — keep it (mirror of elapsed_seconds/60).
-- For live rides, duration_minutes is finalized on stop. For manual logs,
-- elapsed_seconds = duration_minutes * 60.

-- Status index for finding active rides on resume.
create index if not exists idx_sessions_status_live
  on sessions(stable_id, status)
  where status = 'live';

-- Trainer-active-ride index (resume a session per user).
create index if not exists idx_sessions_trainer_live
  on sessions(trainer_id, status, started_at desc)
  where status = 'live';

-- ---------------- SESSION_TRACKS — raw GPS points ----------------
create table if not exists session_tracks (
  id            bigserial primary key,
  session_id    uuid        not null references sessions(id) on delete cascade,
  recorded_at   timestamptz not null,
  -- WGS84 coords; stored as separate numerics for portability (no PostGIS dep).
  lat           numeric(9,6) not null,
  lng           numeric(9,6) not null,
  altitude_m    numeric(7,1),
  accuracy_m    numeric(7,1),
  speed_mps     numeric(6,2),   -- speed in m/s from geolocation API
  heading_deg   numeric(5,1),
  created_at    timestamptz not null default now()
);

comment on table session_tracks is
  'Raw GPS waypoints captured during a live session. Append-only. Finalize step computes rollups + polyline and (optionally) keeps a window of recent points only.';

create index if not exists idx_session_tracks_session_time
  on session_tracks(session_id, recorded_at);

-- ---------------- RLS for session_tracks ----------------
alter table session_tracks enable row level security;
alter table session_tracks force row level security;

-- Read: same audience as the parent session.
-- We piggyback on sessions' RLS via EXISTS.
create policy session_tracks_read on session_tracks
  for select
  using (
    exists (
      select 1 from sessions s
      where s.id = session_tracks.session_id
        and s.stable_id = current_stable_id()
        and (
          current_user_role() in ('owner', 'employee')
          or (
            current_user_role() = 'client'
            and s.rider_client_id = current_client_id()
          )
        )
    )
  );

-- Insert: only the trainer who started the live session may append points
-- to it (their own ride). Owners can also write on behalf (e.g. dashboard
-- corrections). Clients append to their own rides (Personal app).
create policy session_tracks_write on session_tracks
  for all
  using (
    exists (
      select 1 from sessions s
      where s.id = session_tracks.session_id
        and s.stable_id = current_stable_id()
        and (
          current_user_role() = 'owner'
          or (
            current_user_role() = 'employee'
            and s.trainer_id = auth.uid()
          )
          or (
            current_user_role() = 'client'
            and s.rider_client_id = current_client_id()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from sessions s
      where s.id = session_tracks.session_id
        and s.stable_id = current_stable_id()
        and (
          current_user_role() = 'owner'
          or (
            current_user_role() = 'employee'
            and s.trainer_id = auth.uid()
          )
          or (
            current_user_role() = 'client'
            and s.rider_client_id = current_client_id()
          )
        )
    )
  );

-- =============================================================
-- DONE — apply via Supabase Studio → SQL Editor.
-- After applying: run `npm run types:gen` locally to refresh
-- lib/types/database.ts.
-- =============================================================
