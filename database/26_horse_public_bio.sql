-- =============================================================
-- 26_horse_public_bio.sql
--
-- Public bio for horses — what the owner is willing to show clients
-- in the portal. Aim: a young rider can tap their lesson's horse
-- name and see the photo + a short paragraph ("This is Bella, the
-- chestnut mare with a white blaze. She loves carrots."), so they
-- recognise the horse in the pasture without asking the trainer.
--
-- Privacy model: owner curates the bio explicitly — we don't expose
-- internal `notes` or workload caps to clients. If the bio is empty,
-- clients see only the name + photo (still useful).
--
-- The companion RLS policy lets a client read horse rows for any
-- horse that appears on one of their confirmed/completed lessons.
-- That policy already exists (07_calendar_policies.sql:
-- horses_read_via_own_lesson). We just need to add the column.
--
-- Pure additive: no data migration; existing rows get NULL.
-- =============================================================

alter table horses
  add column public_bio text;

comment on column horses.public_bio is
  'Owner-curated public description visible to clients in their portal. Used so a rider (especially kids) can recognise their assigned horse before a lesson without asking the trainer. NULL = no bio surfaced.';

-- =============================================================
-- DONE. Run this in the Supabase SQL Editor (or supabase db push).
-- =============================================================
