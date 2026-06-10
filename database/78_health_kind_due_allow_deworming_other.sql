-- =============================================================
-- 78_health_kind_due_allow_deworming_other.sql
-- Deworming and "other" records recur too, so allow them a next_due_on
-- date. Only injury still forbids next_due. Must run after 77 (the new
-- enum values must be committed before they can appear in this CHECK).
-- =============================================================
alter table horse_health_records
  drop constraint if exists due_only_for_recurring;

alter table horse_health_records
  add constraint due_only_for_recurring check (
    next_due_on is null
    or kind in ('vaccination', 'farrier', 'vet', 'deworming', 'other')
  );

notify pgrst, 'reload schema';
