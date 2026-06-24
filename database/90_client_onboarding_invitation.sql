-- =============================================================
-- 90_client_onboarding_invitation.sql
-- Phase 1 of the TJK digital onboarding flow.
--
-- One button in the client profile sends a SECURE onboarding invitation:
-- a unique token link the client opens (no password) to review the club's
-- first-lesson info and — in later phases — fill their details and sign
-- the required agreements. This migration adds the status machine + token
-- + audit columns to `clients`.
--
-- Status machine (onboarding_status):
--   not_invited -> invited -> opened -> submitted -> signed -> completed
-- Phase 1 covers: not_invited -> invited -> opened.
--
-- Duplicate-send protection: the send server action flips
-- not_invited -> invited with a CONDITIONAL UPDATE (... WHERE
-- onboarding_status = 'not_invited' RETURNING ...). Only one concurrent
-- request can win that update, so a double-click can never send twice.
-- The onboarding_token is the secret; the public /onboarding/[token]
-- route reads the client via the service role (token = capability), never
-- via a client directory — same model as guest_contributor_tokens.
-- =============================================================

do $$ begin
  create type onboarding_status as enum
    ('not_invited','invited','opened','submitted','signed','completed');
exception when duplicate_object then null; end $$;

alter table clients
  add column if not exists onboarding_status onboarding_status not null default 'not_invited',
  add column if not exists onboarding_token text unique,
  add column if not exists onboarding_token_expires_at timestamptz,
  add column if not exists onboarding_sent_at timestamptz,
  add column if not exists onboarding_sent_to text,
  add column if not exists onboarding_sent_by uuid references profiles(id) on delete set null,
  add column if not exists onboarding_opened_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz;

-- Fast lookup from the public onboarding route (service-role read by token).
create index if not exists idx_clients_onboarding_token
  on clients (onboarding_token)
  where onboarding_token is not null;

-- PostgREST: reload schema cache so the new columns are queryable.
notify pgrst, 'reload schema';
