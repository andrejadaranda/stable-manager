-- 61_horse_height_cm_replaces_hands.sql
-- European convention: horse height measured in cm at the withers.
-- Hands notation is Anglo/imperial — wrong default for an EU SaaS.
-- This migration:
--   1. Adds height_cm (integer, 80-220 range — pony to draft).
--   2. Backfills from existing height_hands. "16.2" in hh-notation
--      means 16 hands + 2 inches = 16 * 10.16 + 2 * 2.54 = 167.64 cm.
--   3. Drops the legacy height_hands column.
--
-- Already applied via Supabase MCP. This file is the canonical
-- source-of-truth copy.

alter table horses
  add column if not exists height_cm integer
  check (height_cm is null or height_cm between 80 and 220);

update horses
   set height_cm = round(
     floor(height_hands::numeric) * 10.16
     + (height_hands::numeric - floor(height_hands::numeric)) * 10 * 2.54
   )::integer
 where height_hands is not null
   and height_cm is null;

alter table horses drop column if exists height_hands;

comment on column horses.height_cm is
  'Horse height in centimetres measured at the withers. European convention. Range 80-220.';
