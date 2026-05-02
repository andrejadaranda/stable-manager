-- =============================================================
-- 33_lesson_series.sql
--
-- Track which lessons belong to a recurring series. The existing
-- createRecurringLessons() service creates N independent rows; this
-- migration links them with a shared series_id so the UI can:
--   - Show "Part of an N-week series" on a lesson card.
--   - Offer "Cancel all future occurrences" instead of cancel-one.
--   - Surface an upcoming-series count on the client profile.
--
-- Storage: nullable uuid on lessons. Existing rows stay null. New
-- recurring sets get a fresh uuid generated server-side.
-- =============================================================

alter table lessons
  add column series_id uuid;

create index on lessons (series_id) where series_id is not null;

comment on column lessons.series_id is
  'Shared id across all lessons created from a single recurring booking. NULL for one-off lessons.';

-- =============================================================
-- DONE.
-- =============================================================
