-- =============================================================
-- 31_waitlist_signups.sql
--
-- Public waitlist email capture. Replaces the silent `alert()` on the
-- marketing landing page with a real DB row.
--
-- Privacy:
--   * Anyone can INSERT (anonymous form post).
--   * No one but the service role can SELECT — emails never leak via
--     anon Supabase client. Andreja reads them via the SQL editor.
--
-- Hardening:
--   * UNIQUE on email so a re-submit doesn't duplicate.
--   * `confirmed_at` will flip non-null when the user clicks the
--     double-opt-in link (Resend integration, separate ship).
-- =============================================================

create table waitlist_signups (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  source          text,           -- e.g. "landing", "instagram"
  yard_size       text,           -- optional: "small" | "medium" | "large"
  country         text,           -- optional ISO-2: "LT", "PL", "DE"
  confirmed_at    timestamptz,
  created_at      timestamptz not null default now(),
  -- IP / UA captured for spam tracing only — never displayed.
  ip              text,
  user_agent      text,
  constraint waitlist_email_unique unique (lower(email)) deferrable initially deferred
);

create index on waitlist_signups (created_at desc);
create index on waitlist_signups (country)  where country is not null;
create index on waitlist_signups (confirmed_at) where confirmed_at is not null;

-- ---------------- RLS ----------------
alter table waitlist_signups enable row level security;
alter table waitlist_signups force  row level security;

-- Anyone (anon role) can insert their email. Anti-flood is handled
-- in the API route (rate-limit by IP) since RLS can't see request
-- timing.
create policy waitlist_anon_insert on waitlist_signups
  for insert
  to anon, authenticated
  with check (
    -- minimal sanity at the DB layer; full validation in the API.
    email is not null
    and length(email) between 5 and 320
    and email like '%@%.%'
  );

-- NOBODY can read or update by default. Service role bypasses RLS
-- so the SQL editor still works. Future: read policy for owner role
-- if Andreja wants an in-dashboard waitlist view.

-- =============================================================
-- DONE. Run this in the Supabase SQL Editor (or supabase db push).
-- =============================================================
