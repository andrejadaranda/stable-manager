-- =============================================================
-- 92_horse_boarding_end_date.sql
--
-- "Horse left the stable" — a departure date that STOPS boarding
-- charges from being generated for months after the horse is gone.
--
-- Why a date (not just horses.active = false):
--   * `active` also hides the horse from lessons, lists, health, etc.
--     A departed boarder should still keep its history + profile.
--   * A date lets billing be exact: the month the horse leaves is still
--     billed (it was present part of it); the month AFTER is not.
--   * Mirrors the existing horses.boarding_start_date (21_horse_boarding).
--
-- Rule used by the generators (services/boarding.ts):
--   include a month M if  boarding_end_date IS NULL
--                     OR   boarding_end_date >= first_day_of_M
--   → the departure month is billed, later months are skipped.
--
-- Pure additive: nullable column, no data migration, existing horses
-- keep boarding_end_date = NULL (still boarding).
-- =============================================================

alter table horses
  add column if not exists boarding_end_date date;

comment on column horses.boarding_end_date is
  'Date the horse left the stable. When set, boarding charges are not generated for months after this date (the departure month is still billed). NULL = still boarding.';

-- Optional sanity: end can''t precede start (only checked when both set).
alter table horses
  drop constraint if exists horses_boarding_dates_order;
alter table horses
  add constraint horses_boarding_dates_order
  check (
    boarding_end_date is null
    or boarding_start_date is null
    or boarding_end_date >= boarding_start_date
  );

-- PostgREST: refresh schema cache so the new column is queryable at once.
notify pgrst, 'reload schema';

-- =============================================================
-- DONE.
-- =============================================================
