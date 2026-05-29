-- Migration 62 — Group lessons.
--
-- A real-world riding school runs 70-80% of its lessons as GROUPS
-- (one trainer + 4-8 riders + 4-8 horses, all in the same arena slot).
-- Until now `lessons` modelled a strict 1:1 (one client, one horse).
-- That works for private lessons; it breaks for everything else.
--
-- This migration introduces `lesson_participants` as the source of
-- truth for who's in a lesson. Each row = one (client + horse) pair
-- inside one lesson. Group capacity is enforced by lessons.max_participants.
--
-- BACKWARD COMPATIBILITY: lessons.client_id + lessons.horse_id stay
-- on the row for now — they continue to represent the FIRST participant
-- so existing services + UI don't break in this migration. A follow-up
-- migration will drop them once the codebase fully reads from
-- lesson_participants.
--
-- CONSTRAINT MIGRATION: the old no_horse_double_booking / no_trainer_
-- double_booking constraints were on the `lessons` table. They worked
-- when each lesson had exactly one horse. For group lessons we need
-- the same protection on the per-participant horse — moved to the
-- new junction table. Trainer double-booking stays on lessons (still
-- one trainer per lesson).

begin;

-- ---------------------------------------------------------------------------
-- 1. Add capacity + type columns to lessons.
-- ---------------------------------------------------------------------------

alter table lessons
  add column if not exists max_participants integer not null default 1,
  add column if not exists lesson_type text not null default 'individual';

alter table lessons
  add constraint lessons_max_participants_range
    check (max_participants between 1 and 20);

alter table lessons
  add constraint lessons_type_valid
    check (lesson_type in ('individual', 'group'));

-- Lessons created via UI before this migration are all individual.
update lessons set lesson_type = 'individual', max_participants = 1
where lesson_type is null or max_participants is null;

-- ---------------------------------------------------------------------------
-- 2. Drop the per-horse exclusion constraint on lessons.
-- It was designed for 1:1 lessons. With groups, a "horse double-booking"
-- only makes sense at the participant level — same horse in two
-- overlapping participant rows is the conflict to prevent.
-- ---------------------------------------------------------------------------

alter table lessons drop constraint if exists no_horse_double_booking;

-- Trainer double-booking still applies (one trainer per lesson).

-- ---------------------------------------------------------------------------
-- 3. lesson_participants — junction table.
-- ---------------------------------------------------------------------------

create table if not exists lesson_participants (
  lesson_id    uuid not null references lessons(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete restrict,
  horse_id     uuid not null references horses(id)  on delete restrict,
  status       text not null default 'confirmed',
  joined_at    timestamptz not null default now(),
  no_show      boolean not null default false,
  notes        text,

  primary key (lesson_id, client_id),

  constraint lesson_participants_status_valid
    check (status in ('confirmed', 'cancelled', 'no_show', 'waitlist'))
);

create index if not exists lesson_participants_lesson_idx on lesson_participants(lesson_id);
create index if not exists lesson_participants_client_idx on lesson_participants(client_id);
create index if not exists lesson_participants_horse_idx  on lesson_participants(horse_id);

-- ---------------------------------------------------------------------------
-- 4. Horse double-booking — re-enforced at participant level via a trigger.
-- (Postgres exclude constraints can't span tables, so we use a trigger.)
-- Skips check when participant is cancelled or no_show.
-- ---------------------------------------------------------------------------

create or replace function check_horse_not_double_booked() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_starts timestamptz;
  new_ends   timestamptz;
  conflict_count integer;
begin
  if new.status not in ('confirmed') then
    return new;
  end if;

  -- Get the lesson's time window
  select l.starts_at, l.ends_at into new_starts, new_ends
  from lessons l where l.id = new.lesson_id;

  -- Look for another confirmed participant on the same horse whose
  -- lesson overlaps the new participant's lesson window.
  select count(*) into conflict_count
  from lesson_participants lp
  join lessons l on l.id = lp.lesson_id
  where lp.horse_id = new.horse_id
    and lp.status = 'confirmed'
    and (lp.lesson_id, lp.client_id) <> (new.lesson_id, new.client_id)
    and l.status in ('scheduled', 'completed')
    and tstzrange(l.starts_at, l.ends_at, '[)') && tstzrange(new_starts, new_ends, '[)');

  if conflict_count > 0 then
    raise exception 'Horse is already booked into an overlapping lesson at that time'
      using errcode = '23P01';
  end if;

  return new;
end $$;

drop trigger if exists trg_check_horse_not_double_booked on lesson_participants;
create trigger trg_check_horse_not_double_booked
  before insert or update of horse_id, status on lesson_participants
  for each row execute function check_horse_not_double_booked();

-- ---------------------------------------------------------------------------
-- 5. RLS — same scope as the parent lesson.
-- ---------------------------------------------------------------------------

alter table lesson_participants enable row level security;

-- Helper: which stable does this participant row belong to?
-- (via lesson_id → lessons.stable_id). Read-only, SECURITY DEFINER so
-- it can read lessons.stable_id even when the caller has no row-level
-- access to that lesson yet (avoids RLS chicken-and-egg loop).

create or replace function lesson_participant_stable_id(p_lesson_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select stable_id from lessons where id = p_lesson_id;
$$;
revoke all on function lesson_participant_stable_id(uuid) from public;
grant execute on function lesson_participant_stable_id(uuid) to authenticated;

-- Read: owner + employees of the stable; clients see their own rows.
create policy lesson_participants_read_owner_employee on lesson_participants
  for select to authenticated
  using (
    lesson_participant_stable_id(lesson_id) = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  );

create policy lesson_participants_read_client_own on lesson_participants
  for select to authenticated
  using (
    client_id in (
      select id from clients where profile_id = auth.uid()
    )
  );

-- Write: owner + employees only.
create policy lesson_participants_write_owner_employee on lesson_participants
  for all to authenticated
  using (
    lesson_participant_stable_id(lesson_id) = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  )
  with check (
    lesson_participant_stable_id(lesson_id) = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  );

-- ---------------------------------------------------------------------------
-- 6. Backfill — every existing lesson becomes a 1-participant lesson.
-- ---------------------------------------------------------------------------

insert into lesson_participants (lesson_id, client_id, horse_id, status, joined_at)
select id, client_id, horse_id, 'confirmed', created_at
from lessons
where not exists (
  select 1 from lesson_participants lp where lp.lesson_id = lessons.id
)
on conflict (lesson_id, client_id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Sanity: every lesson must have at least one participant after backfill.
-- ---------------------------------------------------------------------------

do $$
declare
  orphan_count integer;
begin
  select count(*) into orphan_count from lessons l
  where not exists (select 1 from lesson_participants lp where lp.lesson_id = l.id);

  if orphan_count > 0 then
    raise warning '% lessons have zero participants after backfill', orphan_count;
  end if;
end $$;

commit;
