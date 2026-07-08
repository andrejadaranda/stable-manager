-- =============================================================
-- 95_push_native.sql
-- Native (APNs) push support for the iOS app — companion to the web
-- push_subscriptions table (76). Dormant until APNS_* env vars are set
-- and an entitlement-enabled build registers device tokens.
--
--   push_native_tokens      — one row per device APNs token, keyed by
--                             auth_user_id (= auth.uid()). The reminders
--                             cron sends 15-min lesson pushes + morning
--                             digests here via lib/push/send.
--   push_morning_digest_log — idempotency for the once-a-day morning
--                             "today's lessons" digest, per (user, day).
--
-- Applied via Supabase MCP.
-- =============================================================

create table if not exists push_native_tokens (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null,
  token         text not null unique,
  platform      text not null default 'ios',
  stable_id     uuid,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists push_native_tokens_user_idx on push_native_tokens (auth_user_id);

alter table push_native_tokens enable row level security;

-- Users manage only their own device tokens. The sender uses the service
-- role (bypasses RLS) to read every recipient's tokens.
drop policy if exists push_native_tokens_own on push_native_tokens;
create policy push_native_tokens_own on push_native_tokens
  for all
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ------------------------------------------------------------
-- Morning digest idempotency — one push per user per calendar day.
-- day_key is the Europe/Vilnius wall date "YYYY-MM-DD".
-- ------------------------------------------------------------
create table if not exists push_morning_digest_log (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null,
  day_key       text not null,
  status        text not null default 'sent',
  created_at    timestamptz not null default now(),
  unique (auth_user_id, day_key)
);

alter table push_morning_digest_log enable row level security;
-- Service-role only (no anon/authenticated policy) — written by the cron.
