-- =============================================================
-- 93_boarding_charge_unique_month.sql
--
-- One boarding charge per horse per billing month. This lets the app
-- lazily auto-generate the current month's boarding on page load (and
-- lets the "Generate for month" button run) without ever creating a
-- duplicate — inserts use ON CONFLICT DO NOTHING against this index.
--
-- Safe/additive: verified no existing (horse_id, period_start) dupes
-- before adding.
-- =============================================================

create unique index if not exists horse_boarding_charges_horse_month_uniq
  on horse_boarding_charges (horse_id, period_start);

notify pgrst, 'reload schema';
