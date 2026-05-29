-- Migration 63 — Multi-arena scheduling.
--
-- Until now the calendar treated each stable as if it had exactly one
-- riding space. Real-world yards have an indoor arena + 1-2 outdoor
-- arenas. Two trainers can run parallel lessons only if the system
-- knows which physical arena each lesson is in.
--
-- This migration introduces `arenas` and `lessons.arena_id`. Every
-- existing stable gets a "Main arena" backfilled so current lessons
-- continue working with arena_id set to that default.
--
-- A no_arena_double_booking exclusion constraint protects against two
-- confirmed lessons occupying the same arena at overlapping times.
-- The existing no_trainer_double_booking constraint already prevents
-- the same trainer from being in two places at once.

begin;

-- ---------------------------------------------------------------------------
-- 1. arenas table.
-- ---------------------------------------------------------------------------

create table if not exists arenas (
  id          uuid primary key default gen_random_uuid(),
  stable_id   uuid not null references stables(id) on delete cascade,
  name        text not null,
  surface     text,                                       -- 'sand' | 'grass' | 'indoor' | 'outdoor' | NULL = unspecified
  color       text not null default '#1E3A2A',            -- hex, used for calendar event stripe
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint arenas_name_not_blank check (length(trim(name)) > 0),
  constraint arenas_name_unique_per_stable unique (stable_id, name)
);

create index if not exists arenas_stable_idx on arenas(stable_id);
create index if not exists arenas_active_idx on arenas(stable_id, active);

-- ---------------------------------------------------------------------------
-- 2. Backfill — every existing stable gets a default "Main arena".
-- ---------------------------------------------------------------------------

insert into arenas (stable_id, name, surface, color, active)
select id, 'Main arena', NULL, '#1E3A2A', true
from stables
where not exists (select 1 from arenas a where a.stable_id = stables.id);

-- ---------------------------------------------------------------------------
-- 3. lessons.arena_id — nullable FK. Backfill from each stable's Main arena.
-- ---------------------------------------------------------------------------

alter table lessons
  add column if not exists arena_id uuid references arenas(id) on delete set null;

create index if not exists lessons_arena_idx on lessons(arena_id, starts_at);

-- Backfill: every existing lesson points at its stable's first arena
-- (deterministically the "Main arena" inserted above).
update lessons l
set arena_id = a.id
from arenas a
where a.stable_id = l.stable_id
  and a.name = 'Main arena'
  and l.arena_id is null;

-- ---------------------------------------------------------------------------
-- 4. No-arena-double-booking exclusion constraint.
-- Only applies to scheduled/completed lessons. Lessons with arena_id IS NULL
-- (TBD arena) skip the check.
-- ---------------------------------------------------------------------------

alter table lessons drop constraint if exists no_arena_double_booking;
alter table lessons
  add constraint no_arena_double_booking exclude using gist (
    arena_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('scheduled', 'completed') and arena_id is not null);

-- ---------------------------------------------------------------------------
-- 5. RLS — tenant scoped (same model as horses / clients).
-- ---------------------------------------------------------------------------

alter table arenas enable row level security;

drop policy if exists arenas_read on arenas;
create policy arenas_read on arenas
  for select to authenticated
  using (stable_id = current_stable_id());

drop policy if exists arenas_write_owner_employee on arenas;
create policy arenas_write_owner_employee on arenas
  for all to authenticated
  using  (stable_id = current_stable_id() and current_user_role() in ('owner', 'employee'))
  with check (stable_id = current_stable_id() and current_user_role() in ('owner', 'employee'));

-- ---------------------------------------------------------------------------
-- 6. updated_at touch trigger (same pattern as horses).
-- ---------------------------------------------------------------------------

create or replace function arenas_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_arenas_touch on arenas;
create trigger trg_arenas_touch
  before update on arenas
  for each row execute function arenas_touch_updated_at();

commit;
