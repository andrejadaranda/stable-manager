-- =============================================================
-- 35_nullable_horse.sql
-- Make horse_id nullable on lessons and sessions.
--
-- Why: trainers need to log a lesson/session before the horse is
-- decided — theory classes, walk-in groups, "assign the horse later"
-- workflows. Andreja flagged this from real-yard testing 2026-05-10.
--
-- Safety:
--   * The GIST exclusion constraint `no_horse_double_booking` uses
--     `horse_id with =`. NULL never equals NULL in a GIST btree_gist
--     comparison, so NULL-horse rows simply never participate in the
--     overlap check — exactly what we want (no horse = no conflict).
--   * `sessions.rider_present` already guarantees a rider; horse can
--     now be NULL without losing the "who rode" data.
--   * Welfare workload counts ignore NULL-horse rows (they have no
--     horse to attribute load to). Handled in the service layer.
-- =============================================================

-- ---------------- LESSONS ----------------
alter table lessons
  alter column horse_id drop not null;

comment on column lessons.horse_id is
  'The horse for this lesson. Nullable — a lesson can be booked before the horse is assigned ("TBD horse"). Welfare workload skips NULL-horse rows.';

-- ---------------- SESSIONS ----------------
alter table sessions
  alter column horse_id drop not null;

comment on column sessions.horse_id is
  'The horse ridden in this session. Nullable — a session can be logged before the horse is recorded. Per-horse timeline + activity heatmap skip NULL-horse rows.';

-- The sessions same-stable trigger reads new.horse_id unconditionally —
-- patch it to skip the horse check when horse_id is NULL.
create or replace function sessions_same_stable() returns trigger
language plpgsql
as $$
declare
  s uuid;
begin
  -- horse must be in this stable — but only if a horse is set
  if new.horse_id is not null then
    select stable_id into s from horses where id = new.horse_id;
    if s is null or s <> new.stable_id then
      raise exception 'sessions: horse_id must belong to the same stable';
    end if;
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

-- v_horse_activity_7d uses an inner reference to sessions.horse_id via
-- the join; NULL-horse sessions simply don't join to any horse row, so
-- the view already excludes them correctly. No view change needed.
