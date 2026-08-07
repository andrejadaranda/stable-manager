-- =============================================================
-- 111_personal_dashboard_ops.sql
--
-- The operational half of the private command centre (migration 110):
-- push delivery, synthetic uptime, an error log, and the Founding
-- Members roster.
--
-- Same contract as 110 — everything is additive, everything is prefixed
-- `dashboard_` (with one deliberate exception, `founding_members`, which
-- is a business roster rather than dashboard plumbing), and the whole
-- file is idempotent and safe to re-run.
--
-- Depends on 110: `dashboard_is_allowed()` and `set_updated_at()` must
-- already exist. Apply 110 first.
--
-- A teardown block is kept at the bottom, commented out. It is the
-- explicit "down" for this migration.
-- =============================================================

-- -------------------------------------------------------------
-- 1. WEB PUSH SUBSCRIPTIONS
-- -------------------------------------------------------------
-- Deliberately NOT the existing product table `push_subscriptions`.
-- Two reasons:
--   * different service worker. The product registers /sw.js at root
--     scope; /personal registers /sw-personal.js scoped to /personal/.
--     A subscription belongs to exactly one worker registration, so the
--     two sets are genuinely different objects, not duplicates.
--   * blast radius. The morning briefing job writes and prunes rows
--     here. Sharing a table with the product's lesson reminders would
--     mean a bug in this dashboard could delete a paying customer's
--     notification subscription.
create table if not exists dashboard_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  -- The push service URL. Unique across the table: re-subscribing on the
  -- same device returns the same endpoint, and an upsert on it is what
  -- keeps a re-install from accumulating dead rows.
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  -- Purely diagnostic ("which of my devices is this?").
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_sent_at  timestamptz
);

create index if not exists dashboard_push_subs_user
  on dashboard_push_subscriptions (auth_user_id);

-- -------------------------------------------------------------
-- 2. SYNTHETIC HEALTH CHECKS  (uptime source)
-- -------------------------------------------------------------
-- One row per successful ping of /api/health. There is no Sentry and no
-- APM in this codebase, so this table IS the uptime source.
--
-- How uptime is computed (services/personalDashboard/uptime.pure.ts):
-- not "what fraction of rows say ok", but "what fraction of the pings we
-- EXPECTED actually arrived". A row can only be written by a live app
-- talking to a live database, so a gap in the series is precisely an
-- outage. Counting only the rows that exist would report 100% while the
-- site was down, which is the exact failure mode this replaces.
--
-- `ok` is still recorded, because the app can be up while the database
-- read fails — that is a real degraded state and it should not count as
-- healthy.
create table if not exists dashboard_health_checks (
  id          bigserial primary key,
  checked_at  timestamptz not null default now(),
  ok          boolean not null,
  -- Round-trip time of the probe query, in ms.
  latency_ms  integer,
  detail      text
);

create index if not exists dashboard_health_checks_recent
  on dashboard_health_checks (checked_at desc);

-- -------------------------------------------------------------
-- 3. ERROR LOG  (error-rate source)
-- -------------------------------------------------------------
-- Written by lib/personal/error-log.ts with the service-role client.
-- Deliberately coarse: message + route + digest, no request bodies, no
-- user identifiers. An error log that accumulates personal data is a
-- liability, and none of it is needed to answer "is something broken".
create table if not exists dashboard_errors (
  id           bigserial primary key,
  occurred_at  timestamptz not null default now(),
  -- 'personal' | 'app' | 'api' — which surface raised it.
  scope        text not null default 'app',
  route        text,
  message      text not null,
  -- Next.js error digest, when the boundary provides one. Lets a client
  -- report be tied back to the server-side stack in the platform logs.
  digest       text,
  stack        text
);

create index if not exists dashboard_errors_recent
  on dashboard_errors (occurred_at desc);

-- -------------------------------------------------------------
-- 4. FOUNDING MEMBERS
-- -------------------------------------------------------------
-- The Founding 15 are onboarded and billed by hand (€25/mo locked for
-- life, 12 months free — see app/dashboard/settings/billing/page.tsx).
-- They therefore have no Stripe subscription and no marker anywhere in
-- the product schema, which is why the dashboard had no number to show.
--
-- This is a roster she maintains, not a derived count. `stable_id` links
-- a member to their Longrein stable once they have signed up, so the
-- dashboard can tell "committed" from "actually using it".
create table if not exists founding_members (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  email        text,
  -- Null until they create their stable. on delete set null so removing a
  -- stable never silently deletes the commercial record of the member.
  stable_id    uuid references stables(id) on delete set null,
  -- 'committed' → agreed, not onboarded yet
  -- 'active'    → onboarded and using it
  -- 'churned'   → left
  status       text not null default 'committed'
                 check (status in ('committed', 'active', 'churned')),
  -- What they will pay once the 12 free months end. Kept per member
  -- because the lock-in price is negotiated per member.
  monthly_eur  numeric(10,2) not null default 25,
  joined_on    date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists founding_members_status
  on founding_members (status);

-- -------------------------------------------------------------
-- 5. RLS
-- -------------------------------------------------------------
-- dashboard_push_subscriptions is per-user: same shape as every table in
-- migration 110 — your own rows, and only while you are allowlisted.
alter table dashboard_push_subscriptions enable row level security;
alter table dashboard_push_subscriptions force  row level security;
drop policy if exists dashboard_push_subscriptions_own on dashboard_push_subscriptions;
create policy dashboard_push_subscriptions_own on dashboard_push_subscriptions
  for all
  using      (auth_user_id = auth.uid() and dashboard_is_allowed())
  with check (auth_user_id = auth.uid() and dashboard_is_allowed());

-- founding_members is NOT per-user — it is a platform roster. Any
-- allowlisted operator may read and edit it; nobody else can see it
-- exists.
alter table founding_members enable row level security;
alter table founding_members force  row level security;
drop policy if exists founding_members_operator on founding_members;
create policy founding_members_operator on founding_members
  for all
  using      (dashboard_is_allowed())
  with check (dashboard_is_allowed());

drop trigger if exists trg_founding_members_updated on founding_members;
create trigger trg_founding_members_updated
  before update on founding_members
  for each row execute function set_updated_at();

-- dashboard_health_checks and dashboard_errors get RLS enabled with NO
-- policy at all. That is not an oversight: RLS-on-with-no-policy denies
-- every request from anon and authenticated roles, and the service-role
-- key bypasses RLS entirely. These two tables are written by cron and
-- read through the admin client (services/personalDashboard/longrein.ts),
-- so no browser session ever needs to touch them. Locking them shut is
-- strictly safer than writing a policy that could drift.
alter table dashboard_health_checks enable row level security;
alter table dashboard_health_checks force  row level security;
alter table dashboard_errors        enable row level security;
alter table dashboard_errors        force  row level security;

comment on table dashboard_health_checks is
  'Synthetic uptime probe results. Uptime = received pings / expected pings over a window. Service-role only.';
comment on table dashboard_errors is
  'Coarse error log for the personal dashboard error-rate card. No PII. Service-role only.';
comment on table founding_members is
  'Manually maintained Founding 15 roster. The Founding Members are hand-billed and have no Stripe subscription, so there is nothing to derive this from.';

-- -------------------------------------------------------------
-- 6. TEARDOWN  (the "down" for this migration)
-- -------------------------------------------------------------
--   drop table if exists dashboard_push_subscriptions;
--   drop table if exists dashboard_health_checks;
--   drop table if exists dashboard_errors;
--   drop trigger if exists trg_founding_members_updated on founding_members;
--   drop table if exists founding_members;
--
-- Nothing in migration 110 depends on any of these, and nothing in the
-- Longrein product references them at all, so this drop is complete and
-- has no product-side consequence.
