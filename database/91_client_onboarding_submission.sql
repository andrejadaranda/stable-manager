-- =============================================================
-- 91_client_onboarding_submission.sql
-- Phase 2 of the TJK digital onboarding flow: the self-service form the
-- client fills at /onboarding/<token>. Captures the rider's own details
-- and — for a minor — the parent/guardian who is legally responsible.
--
-- The rider IS the client row. Guardian details live on the same row for
-- now (Phase 4 promotes them into linked parent profiles). emergency_*
-- columns already exist (migration with emergency_contact_*); we reuse them.
--
-- Submitting flips onboarding_status -> 'submitted' and writes everything
-- straight onto the client — the whole point is zero manual data entry by
-- staff.
-- =============================================================

alter table clients
  add column if not exists date_of_birth         date,
  add column if not exists is_minor              boolean,
  add column if not exists guardian_name         text,
  add column if not exists guardian_relationship text,
  add column if not exists guardian_email        text,
  add column if not exists guardian_phone        text,
  add column if not exists riding_experience     text,
  add column if not exists medical_notes         text,
  add column if not exists allergies             text,
  add column if not exists onboarding_submitted_at timestamptz;

notify pgrst, 'reload schema';
