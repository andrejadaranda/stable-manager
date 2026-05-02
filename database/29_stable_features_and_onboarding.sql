-- =============================================================
-- 29_stable_features_and_onboarding.sql
--
-- Two additions in one migration since they ship together:
--
-- A. Per-stable feature toggles -- stables.features JSONB.
--    Lets the owner hide modules they don't use. A small private
--    livery with no lessons disables packages/services; a riding
--    school with no boarding disables boarding. Sidebar + Settings
--    tabs filter based on these flags.
--
--    Storage: jsonb, default = everything enabled. Service-layer
--    coerces missing keys to default values, so adding new feature
--    keys later doesn't require a backfill.
--
-- B. First-time welcome tutorial -- profiles.onboarded_at TIMESTAMPTZ.
--    NULL until the user has either completed or skipped the tour.
--    Set once; replaying the tour from a Help menu writes the same
--    column with a fresh timestamp (idempotent).
--
-- RLS:
--   * stables.features inherits existing stables RLS (owner reads/writes
--     their own row).
--   * profiles.onboarded_at uses existing profiles RLS (self-only).
-- =============================================================

-- ---------------- A. Stable features ----------------
alter table stables
  add column features jsonb not null default '{
    "sessions":             true,
    "packages":             true,
    "services":             true,
    "boarding":             true,
    "client_charges":       true,
    "reminders":            true,
    "agreements":           true,
    "public_horse_bios":    true,
    "chat":                 true,
    "recurring_lessons":    true,
    "welfare_hard_limits":  true
  }'::jsonb;

-- Backfill existing rows that were created before this migration
-- (default applies only to new rows).
update stables
   set features = '{
        "sessions":             true,
        "packages":             true,
        "services":             true,
        "boarding":             true,
        "client_charges":       true,
        "reminders":            true,
        "agreements":           true,
        "public_horse_bios":    true,
        "chat":                 true,
        "recurring_lessons":    true,
        "welfare_hard_limits":  true
       }'::jsonb
 where features is null
    or features = '{}'::jsonb;

-- ---------------- B. Onboarded timestamp -------------
alter table profiles
  add column onboarded_at timestamptz;

-- =============================================================
-- DONE. Run this in the Supabase SQL Editor (or supabase db push).
-- =============================================================
