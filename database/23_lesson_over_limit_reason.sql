-- =============================================================
-- 23_lesson_over_limit_reason.sql
--
-- Welfare enforcement audit field. When a trainer creates or moves a
-- lesson that pushes a horse over its `daily_lesson_limit` or
-- `weekly_lesson_limit`, the service layer rejects the write with a
-- friendly error. To proceed, the trainer must provide an explicit
-- reason — saved in this column. NULL = booking was within limits.
--
-- This makes welfare enforcement legible later: a stable manager can
-- query "which lessons ran over and why" for any audit, FEI review,
-- or insurance dispute.
--
-- Pure additive: no data migration; existing lessons get NULL.
-- =============================================================

alter table lessons
  add column over_limit_reason text;

comment on column lessons.over_limit_reason is
  'Set ONLY when this lesson was knowingly booked over the horse''s daily or weekly cap. NULL = booking was within limits. The text is the trainer-supplied justification (e.g. "Show prep, agreed with Marija to run +1 today").';

create index on lessons(stable_id, horse_id) where over_limit_reason is not null;

-- =============================================================
-- DONE. Run this in the Supabase SQL Editor (or supabase db push).
-- =============================================================
