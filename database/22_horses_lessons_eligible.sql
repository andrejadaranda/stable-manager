-- =============================================================
-- 22_horses_lessons_eligible.sql
--
-- "Available for lessons" toggle on horses. Drives which horses appear
-- in the calendar's lesson-create dropdown.
--
-- The rule:
--   * Stable-owned (owner_client_id IS NULL)        → always eligible.
--     Boarding doesn't apply, the stable rents the horse for lessons.
--   * Client-owned (owner_client_id IS NOT NULL)    → eligible only
--     when `available_for_lessons = TRUE`. The horse owner has to
--     explicitly opt in (typically with a discount agreement).
--
-- Default for the column is FALSE: existing client-owned horses won't
-- accidentally appear in lesson dropdowns until the owner clicks the
-- toggle. Stable-owned rows ignore this flag.
--
-- Pure additive: existing horses get FALSE by default, but the rule
-- above means they still appear if owner_client_id is NULL.
-- =============================================================

alter table horses
  add column available_for_lessons boolean not null default false;

comment on column horses.available_for_lessons is
  'Client-owned horses must opt in here to appear in the lessons dropdown. Stable-owned horses (owner_client_id IS NULL) always appear regardless.';

-- Index so the lessons-eligible filter on the calendar is fast.
create index on horses(stable_id, active, available_for_lessons);

-- =============================================================
-- DONE. Run this in the Supabase SQL Editor (or supabase db push).
-- =============================================================
