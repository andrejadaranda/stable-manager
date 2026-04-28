-- =============================================================
-- 12_sessions.sql
-- The "horse activity" core table — every ride that happens, logged.
-- This is the wedge from the Master Plan. Adds the missing module
-- that turns the platform from a calendar into an activity record.
--
-- Conventions match 02_schema.sql:
--   - tenant root: stable_id on every row
--   - same-stable validation triggers as defense-in-depth
--   - set_updated_at() trigger from 02_schema.sql
--   - role enum reused: owner / employee / client
-- =============================================================

-- ---------------- ENUM ----------------
create type session_type as enum (
  'flat', 'jumping', 'lunging', 'groundwork', 'hack', 'other'
);

-- ---------------- TABLE ----------------
create table sessions (
  id                   uuid primary key default gen_random_uuid(),
  stable_id            uuid not null references stables(id) on delete cascade,
  horse_id             uuid not null references horses(id)  on delete cascade,

  -- The rider can be linked three ways. At least one must be present.
  --   1. rider_client_id  — a paying client / boarder rode (most common)
  --   2. rider_profile_id — a staff member rode (training rides)
  --   3. rider_name_freeform — drop-in / kid / no-account rider
  rider_client_id      uuid references clients(id)  on delete set null,
  rider_profile_id     uuid references profiles(id) on delete set null,
  rider_name_freeform  text,

  -- The staff member who logged the session.
  trainer_id           uuid not null references profiles(id) on delete restrict,

  -- Optional link to the lesson this came from. Set when a 'scheduled'
  -- lesson is marked 'completed' and the staff turn it into a session.
  lesson_id            uuid references lessons(id) on delete set null,

  started_at           timestamptz not null default now(),
  duration_minutes     int not null check (duration_minutes between 1 and 600),
  type                 session_type not null default 'flat',
  notes                text,
  rating               smallint check (rating between 1 and 5),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint rider_present check (
    rider_client_id is not null
    or rider_profile_id is not null
    or rider_name_freeform is not null
  )
);

comment on table sessions is
  'Atomic ride record. Optimised for fast inserts (the "log in 15 seconds" wedge) and per-horse timeline reads.';

-- ---------------- INDEXES ----------------
-- Stable feed (dashboard "recent sessions").
create index idx_sessions_stable_started
  on sessions(stable_id, started_at desc);

-- Per-horse timeline (horse detail page).
create index idx_sessions_horse_started
  on sessions(horse_id, started_at desc);

-- Per-client timeline (client portal "my sessions").
create index idx_sessions_rider_client_started
  on sessions(rider_client_id, started_at desc)
  where rider_client_id is not null;

-- Per-trainer timeline (workload reports).
create index idx_sessions_trainer_started
  on sessions(trainer_id, started_at desc);

-- Optional FK lookup.
create index idx_sessions_lesson
  on sessions(lesson_id)
  where lesson_id is not null;

-- ---------------- updated_at TRIGGER ----------------
create trigger trg_sessions_updated
  before update on sessions
  for each row execute function set_updated_at();

-- ---------------- SAME-STABLE VALIDATION ----------------
-- Defense-in-depth. Even if RLS is bypassed (e.g. a future service-role
-- script), this trigger guarantees no cross-stable references can be
-- written. Runs as INVOKER so RLS still narrows the lookups.
create or replace function sessions_same_stable() returns trigger
language plpgsql
as $$
declare
  s uuid;
begin
  -- horse must be in this stable
  select stable_id into s from horses where id = new.horse_id;
  if s is null or s <> new.stable_id then
    raise exception 'sessions: horse_id must belong to the same stable';
  end if;

  if new.rider_client_id is not null then
    select stable_id into s from clients where id = new.rider_client_id;
    if s is null or s <> new.stable_id then
      raise exception 'sessions: rider_client_id must belong to the same stable';
    end if;
  end if;

  if new.rider_profile_id is not null then
    select stable_id into s from profiles where id = new.rider_profile_id;
    if s is null or s <> new.stable_id then
      raise exception 'sessions: rider_profile_id must belong to the same stable';
    end if;
  end if;

  select stable_id into s from profiles where id = new.trainer_id;
  if s is null or s <> new.stable_id then
    raise exception 'sessions: trainer_id must belong to the same stable';
  end if;

  if new.lesson_id is not null then
    select stable_id into s from lessons where id = new.lesson_id;
    if s is null or s <> new.stable_id then
      raise exception 'sessions: lesson_id must belong to the same stable';
    end if;
  end if;

  return new;
end $$;

create trigger trg_sessions_same_stable
  before insert or update on sessions
  for each row execute function sessions_same_stable();

-- ---------------- VIEW: per-horse activity (dashboard heatmap) ----------------
-- Last 7 days of session activity per active horse. Inherits RLS from
-- underlying tables in PG15+ when security_invoker = on.
create or replace view v_horse_activity_7d as
select
  h.id        as horse_id,
  h.stable_id,
  h.name,
  count(s.id)::int as sessions_last_7d,
  coalesce(sum(s.duration_minutes), 0)::int as minutes_last_7d,
  max(s.started_at) as last_session_at
from horses h
left join sessions s
  on s.horse_id = h.id
 and s.started_at >= now() - interval '7 days'
where h.active = true
group by h.id, h.stable_id, h.name;

alter view v_horse_activity_7d set (security_invoker = on);

comment on view v_horse_activity_7d is
  'Per-active-horse session counts for the dashboard heatmap. RLS-safe.';
