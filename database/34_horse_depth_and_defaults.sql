-- =============================================================
-- 34_horse_depth_and_defaults.sql
--
-- Tester feedback round 1:
--   1. Default lesson limits 2/day, 14/week (was 4/20). Owner can
--      override per-horse.
--   2. Add color, sex, unique_number, height_hh to horses for richer
--      profiles (pedigree tree comes in a later migration).
--   3. Add `is_horse_owner_only` flag to clients so the Clients page
--      can split riders from owners.
-- =============================================================

-- 1. New defaults for lesson limits (existing rows untouched).
alter table horses
  alter column daily_lesson_limit  set default 2,
  alter column weekly_lesson_limit set default 14;

-- 2. Horse depth fields.
alter table horses
  add column if not exists color          text,
  add column if not exists sex            text check (sex is null or sex in ('mare','gelding','stallion','colt','filly')),
  add column if not exists unique_number  text,
  add column if not exists height_hh      numeric(3,1) check (height_hh is null or (height_hh between 8 and 20));

create index if not exists horses_unique_number_idx
  on horses (stable_id, unique_number) where unique_number is not null;

comment on column horses.color is
  'Coat color (e.g. "bay", "chestnut", "grey", "black"). Free text.';
comment on column horses.sex is
  'Sex of the horse — mare / gelding / stallion / colt / filly. Optional.';
comment on column horses.unique_number is
  'Stable-internal ID, brand number, microchip, or passport number. Free text.';
comment on column horses.height_hh is
  'Height in hands (e.g. 16.2 means 16 hands 2 inches). Range 8-20.';

-- 3. Client segmentation flag.
alter table clients
  add column if not exists is_horse_owner_only  boolean not null default false;

comment on column clients.is_horse_owner_only is
  'True when the client is purely a horse-owner (boarder), not a rider. Drives Clients-page filter and skill-level requirement.';

-- 4. Profile photo + phone for the logged-in user. Settings → Profile
--    surfaces these so owners + employees + clients can personalise their
--    own account (replaces the bare initial-letter avatar in the sidebar).
alter table profiles
  add column if not exists photo_url  text,
  add column if not exists phone      text;

comment on column profiles.photo_url is
  'URL of the user''s avatar. Free-text URL until Supabase Storage upload ships in a later migration.';
comment on column profiles.phone is
  'Personal contact phone for the staff member. Optional.';

-- =============================================================
-- DONE.
-- =============================================================
