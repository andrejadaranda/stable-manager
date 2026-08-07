-- =============================================================
-- APPLY_PERSONAL_DASHBOARD.sql
--
-- ONE PASTE. Turns the private command centre at /personal on.
--
-- HOW TO RUN
--   1. supabase.com/dashboard -> the Longrein project -> SQL Editor
--   2. New query -> paste this ENTIRE file -> Run
--   3. Read the two result tables printed at the end:
--        * "objects created" - every row must say ok
--        * "access granted"  - must show exactly one row, your account
--
-- This file is generated: it is migrations 110, 111 and 112
-- concatenated, plus the one INSERT that grants access. You do not need
-- to open or run those two files separately. (They are kept in the repo
-- as the canonical migration history; this is the operator's copy.)
--
-- SAFE TO RE-RUN. Every statement is idempotent, and nothing here alters
-- a single existing Longrein table, policy, function or enum. Running it
-- twice changes nothing. Everything runs inside one transaction, so a
-- failure rolls the whole thing back rather than half-applying.
--
-- TO SWITCH THE WHOLE THING OFF AGAIN (instant, no deploy):
--   update dashboard_access set enabled = false;
--
-- TO REMOVE IT COMPLETELY: see the teardown blocks at the end of
-- database/110_personal_dashboard.sql and 111_personal_dashboard_ops.sql.
-- =============================================================

begin;

-- =============================================================
-- PART 1 of 4 - MIGRATION 110
-- =============================================================

-- =============================================================
-- 110_personal_dashboard.sql
--
-- Private "command centre" dashboard for a single operator (Andrėja).
-- This is NOT a product feature — it is a personal cockpit that sits on
-- top of the existing Longrein data. Everything here is additive:
--
--   * No existing table, view, policy, function or enum is altered.
--   * Every new object is prefixed `dashboard_` so it is trivially
--     greppable and trivially droppable (see the teardown block at the
--     bottom of this file, kept commented out).
--   * Access is gated by `dashboard_access` — an allowlist table that
--     doubles as the feature kill switch. Flip `enabled` to false and
--     the route 404s on the next request. No redeploy needed.
--
-- Applied via Supabase SQL Editor in filename order, per database/README.md.
-- Safe to re-run: every statement is idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 0. ACCESS ALLOWLIST  (= the feature flag)
-- -------------------------------------------------------------
-- Empty table => nobody can reach /personal. That is the default-off
-- state the route ships in. Seeding one row turns it on for one person.
create table if not exists dashboard_access (
  auth_user_id  uuid primary key references auth.users(id) on delete cascade,
  enabled       boolean not null default true,
  label         text,
  created_at    timestamptz not null default now()
);

alter table dashboard_access enable row level security;
alter table dashboard_access force  row level security;

-- A user may read ONLY their own allowlist row. Nobody can write from
-- the client — seeding/revoking is a deliberate SQL-console action so the
-- kill switch can never be flipped by application code (or by a bug).
drop policy if exists dashboard_access_read_own on dashboard_access;
create policy dashboard_access_read_own on dashboard_access
  for select using (auth_user_id = auth.uid());

-- Reusable predicate: "is the caller allowlisted right now?".
-- STABLE (not IMMUTABLE) — it reads a table. SECURITY INVOKER so it can
-- never be used to widen anyone's visibility.
create or replace function dashboard_is_allowed() returns boolean
language sql stable security invoker as $$
  select exists (
    select 1 from dashboard_access
     where auth_user_id = auth.uid()
       and enabled
  );
$$;

-- -------------------------------------------------------------
-- 1. GOALS  (monthly + quarterly targets, configured in the UI)
-- -------------------------------------------------------------
create table if not exists dashboard_goals (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  -- 'month' | 'quarter'. Text rather than an enum: this table is personal
  -- config, and adding 'year' later must not require a migration on a
  -- shared type that other (product) code might come to depend on.
  period        text not null check (period in ('month', 'quarter')),
  -- First day of the period the goal belongs to (2026-08-01, 2026-07-01…).
  period_start  date not null,
  -- Stable machine key: 'lesson_revenue', 'lessons_taught', 'new_clients',
  -- 'ig_posts', 'longrein_mrr', … Free-form so she can invent her own.
  goal_key      text not null,
  label         text not null,
  target        numeric(12,2) not null,
  -- 'eur' | 'count' | 'percent' — drives formatting only.
  unit          text not null default 'count',
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (auth_user_id, period, period_start, goal_key)
);

create index if not exists dashboard_goals_lookup
  on dashboard_goals (auth_user_id, period, period_start);

-- -------------------------------------------------------------
-- 2. DISMISSALS  (snoozing a re-engagement nudge / recommendation)
-- -------------------------------------------------------------
-- Without this the "hasn't ridden in 14 days" list would nag about the
-- same client every single morning even after she has already texted them.
create table if not exists dashboard_dismissals (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  -- 'reengagement' | 'recommendation' | 'briefing_item'
  kind          text not null,
  -- The thing being dismissed: clients.id, a recommendation id, etc.
  ref_id        text not null,
  -- Snooze rather than delete: the nudge comes back after this date.
  snooze_until  date,
  created_at    timestamptz not null default now(),
  unique (auth_user_id, kind, ref_id)
);

create index if not exists dashboard_dismissals_lookup
  on dashboard_dismissals (auth_user_id, kind, snooze_until);

-- -------------------------------------------------------------
-- 3. DAILY BRIEFINGS  (ingested from the Gmail scheduled task)
-- -------------------------------------------------------------
-- The recurring `tjk-daily-inbox-check` job POSTs its output to
-- /api/personal/briefing (service-role, shared-secret authenticated) and
-- it lands here. The dashboard only ever reads.
create table if not exists dashboard_daily_briefings (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  briefing_on   date not null,
  source        text not null default 'gmail',
  summary       text,
  -- [{ title, detail, urgency: 'high'|'normal'|'low', action_url }]
  items         jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  unique (auth_user_id, briefing_on, source)
);

create index if not exists dashboard_briefings_recent
  on dashboard_daily_briefings (auth_user_id, briefing_on desc);

-- -------------------------------------------------------------
-- 4. AI RECOMMENDATIONS  (one generation per person per day)
-- -------------------------------------------------------------
-- The unique constraint is the whole point: page loads must never
-- re-trigger a paid model call. Generation is an upsert keyed on the day.
create table if not exists dashboard_ai_recommendations (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid not null references auth.users(id) on delete cascade,
  generated_on   date not null,
  model          text,
  -- [{ id, title, body, category, priority }]
  recommendations jsonb not null default '[]'::jsonb,
  -- The aggregated numbers the advice was based on. Kept so a
  -- recommendation can be explained ("why did it say that?") after the
  -- underlying data has moved on.
  snapshot       jsonb,
  created_at     timestamptz not null default now(),
  unique (auth_user_id, generated_on)
);

-- -------------------------------------------------------------
-- 5. SOCIAL POST CACHE  (Instagram / Facebook / tjk.lt)
-- -------------------------------------------------------------
-- Metrics are cached rather than fetched live so the Marketing screen
-- renders instantly and one Graph API outage never blanks the dashboard.
create table if not exists dashboard_social_posts (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  platform      text not null check (platform in ('instagram', 'facebook', 'website')),
  external_id   text not null,
  permalink     text,
  caption       text,
  -- 'image' | 'video' | 'carousel' | 'reel' | 'story' | 'article'
  media_type    text,
  posted_at     timestamptz,
  likes         int not null default 0,
  comments      int not null default 0,
  shares        int not null default 0,
  saves         int not null default 0,
  reach         int not null default 0,
  impressions   int not null default 0,
  fetched_at    timestamptz not null default now(),
  unique (auth_user_id, platform, external_id)
);

create index if not exists dashboard_social_recent
  on dashboard_social_posts (auth_user_id, posted_at desc);

-- -------------------------------------------------------------
-- 6. INTEGRATION SETTINGS  (API tokens she pastes in herself)
-- -------------------------------------------------------------
-- Values are jsonb so each integration can carry its own shape
-- (token + account id + expiry). RLS keeps them owner-only; nothing here
-- is ever sent to the browser (see services/personalDashboard/settings.ts,
-- which strips secrets before returning to a client component).
create table if not exists dashboard_integration_settings (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  -- 'instagram' | 'facebook' | 'website' | 'anthropic' | 'monitoring'
  provider      text not null,
  config        jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  unique (auth_user_id, provider)
);

-- -------------------------------------------------------------
-- 7. RLS — identical shape on every dashboard_* data table
-- -------------------------------------------------------------
-- Two conditions, both required:
--   auth_user_id = auth.uid()  → you only ever see your own rows
--   dashboard_is_allowed()     → and only while you're allowlisted
-- Revoking access in dashboard_access therefore also cuts off the data,
-- not just the UI. Defence in depth: the route check and the row check
-- are independent.
do $$
declare t text;
begin
  foreach t in array array[
    'dashboard_goals',
    'dashboard_dismissals',
    'dashboard_daily_briefings',
    'dashboard_ai_recommendations',
    'dashboard_social_posts',
    'dashboard_integration_settings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format('drop policy if exists %I on %I', t || '_own', t);
    execute format($f$
      create policy %I on %I
        for all
        using      (auth_user_id = auth.uid() and dashboard_is_allowed())
        with check (auth_user_id = auth.uid() and dashboard_is_allowed())
    $f$, t || '_own', t);
  end loop;
end $$;

-- updated_at touch triggers, reusing the existing helper from install.sql.
drop trigger if exists trg_dashboard_goals_updated on dashboard_goals;
create trigger trg_dashboard_goals_updated
  before update on dashboard_goals
  for each row execute function set_updated_at();

-- -------------------------------------------------------------
-- 8. READ MODEL — days since each client last rode
-- -------------------------------------------------------------
-- Powers the "hasn't ridden in 14 days → call them" list.
--
-- Deliberately a PLAIN VIEW, not a materialized view. A materialized
-- view over `lessons` would (a) hold every tenant's rows in one
-- unprotected relation — MVs do not honour row level security, so it
-- would be a cross-stable data leak — and (b) need a refresh job, which
-- means the number she acts on could silently be hours stale.
--
-- The cost argument for an MV does not hold here either: the underlying
-- query is a single index-only scan over lessons(client_id, starts_at)
-- — an index that already exists (install.sql) — grouped per client.
-- At Longrein's data volume that is sub-millisecond, and it runs once
-- per dashboard load for one user. There is no measurable load added to
-- anyone else.
--
-- security_invoker => the caller's own RLS on lessons/clients applies,
-- exactly like the existing `billable_items` view (migration 105).
create or replace view dashboard_client_last_ride
with (security_invoker = true) as
select
  c.id                as client_id,
  c.stable_id,
  c.full_name,
  c.email,
  c.phone,
  c.active,
  last_ride.last_ride_at,
  -- NULL last_ride_at (never rode) sorts as "infinitely stale" in the
  -- service layer rather than here, so the view stays a plain read model.
  case
    when last_ride.last_ride_at is null then null
    else (current_date - (last_ride.last_ride_at at time zone 'UTC')::date)
  end                 as days_since_last_ride,
  coalesce(totals.lessons_completed, 0) as lessons_completed,
  next_ride.next_ride_at
from clients c
left join lateral (
  select max(l.starts_at) as last_ride_at
    from lessons l
   where l.client_id = c.id
     and l.status = 'completed'
) last_ride on true
left join lateral (
  select count(*) as lessons_completed
    from lessons l
   where l.client_id = c.id
     and l.status = 'completed'
) totals on true
left join lateral (
  select min(l.starts_at) as next_ride_at
    from lessons l
   where l.client_id = c.id
     and l.status = 'scheduled'
     and l.starts_at >= now()
) next_ride on true;

comment on view dashboard_client_last_ride is
  'Personal dashboard read model: per-client recency of riding. '
  'security_invoker — inherits lessons/clients RLS. Additive; nothing reads this except /personal.';

-- -------------------------------------------------------------
-- 9. SEEDING THE ALLOWLIST  (run this by hand — see PR description)
-- -------------------------------------------------------------
-- This is intentionally NOT executed automatically. Turning the feature
-- on is a deliberate act, and the migration must be safe to apply to a
-- database where nobody should have access yet.
--
--   insert into dashboard_access (auth_user_id, label)
--   select id, 'Andreja — personal command centre'
--     from auth.users
--    where email = 'REPLACE_WITH_HER_LOGIN_EMAIL'
--   on conflict (auth_user_id) do update set enabled = true;
--
-- Kill switch (instant, no deploy):
--   update dashboard_access set enabled = false where auth_user_id = '…';

-- -------------------------------------------------------------
-- 10. TEARDOWN  (kept commented — the whole feature is one paste away
--     from being gone, with zero impact on Longrein)
-- -------------------------------------------------------------
--   drop view if exists dashboard_client_last_ride;
--   drop table if exists dashboard_integration_settings, dashboard_social_posts,
--                        dashboard_ai_recommendations, dashboard_daily_briefings,
--                        dashboard_dismissals, dashboard_goals, dashboard_access;
--   drop function if exists dashboard_is_allowed();


-- =============================================================
-- PART 2 of 4 - MIGRATION 111
-- =============================================================

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



-- =============================================================
-- PART 3 of 4 - MIGRATION 112
-- =============================================================

-- =============================================================
-- 112_personal_social_and_goals.sql
--
-- Two additions to the private command centre:
--   1. Publishing to social media from the dashboard (compose, schedule,
--      multi-platform push, media storage).
--   2. Wider goal tracking — weekly periods, new trackable metrics, and
--      an audience-size series so "Instagram +100 followers" is a goal
--      that can actually be measured.
--
-- Depends on 110 (dashboard_is_allowed, set_updated_at) and 111.
-- Additive and idempotent, like everything before it. Teardown at the
-- bottom.
--
-- NAMING NOTE, worth reading before you grep:
-- `dashboard_social_posts` (migration 110) is the READ cache — metrics
-- fetched back from Meta about posts that already exist. This migration
-- adds `dashboard_social_queue`, the WRITE side — things she has composed
-- and wants published. They are deliberately separate tables: one is
-- disposable cache that can be truncated and refetched at any time, the
-- other contains the only copy of a draft she has written. Merging them
-- would put those two lifecycles in one row.
-- =============================================================

-- -------------------------------------------------------------
-- 1. THE COMPOSE / SCHEDULE QUEUE
-- -------------------------------------------------------------
create table if not exists dashboard_social_queue (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid not null references auth.users(id) on delete cascade,

  -- Which platforms this one piece of content goes to. An array rather
  -- than a row per platform: she writes once and pushes to several, and
  -- keeping it as one row is what makes "edit the draft" mean editing
  -- one thing instead of reconciling three.
  -- 'instagram_feed' | 'instagram_story' | 'facebook_page'
  platforms      text[] not null default '{}',

  content        text not null default '',

  -- [{ url, path, type: 'image'|'video', width, height }]
  -- `url` is the public Supabase Storage URL. Meta's publishing API
  -- fetches the media from that URL itself — it does not accept an
  -- upload — which is why the bucket below has to be public-read.
  media          jsonb not null default '[]'::jsonb,

  -- draft      → saved, not going anywhere
  -- scheduled  → will publish at scheduled_for
  -- publishing → a worker has claimed it (guards against double-send)
  -- published  → every target platform succeeded
  -- partial    → some platforms succeeded, some failed
  -- failed     → nothing succeeded
  status         text not null default 'draft'
                   check (status in ('draft','scheduled','publishing','published','partial','failed')),

  scheduled_for  timestamptz,
  published_at   timestamptz,

  -- { instagram_feed: "17901234...", facebook_page: "1234_5678" }
  -- Keyed by platform so a retry can skip the ones that already landed.
  -- This is what makes retrying safe rather than a way to double-post.
  external_ids   jsonb not null default '{}'::jsonb,

  -- { facebook_page: "(#200) requires pages_manage_posts" }
  last_errors    jsonb not null default '{}'::jsonb,

  attempts       int not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- A scheduled post with no time would sit in the queue forever.
  constraint dashboard_social_queue_scheduled_needs_time
    check (status <> 'scheduled' or scheduled_for is not null)
);

-- The publisher's hot path: "anything due, not yet claimed".
create index if not exists dashboard_social_queue_due
  on dashboard_social_queue (status, scheduled_for)
  where status in ('scheduled', 'publishing');

create index if not exists dashboard_social_queue_recent
  on dashboard_social_queue (auth_user_id, created_at desc);

drop trigger if exists trg_dashboard_social_queue_updated on dashboard_social_queue;
create trigger trg_dashboard_social_queue_updated
  before update on dashboard_social_queue
  for each row execute function set_updated_at();

alter table dashboard_social_queue enable row level security;
alter table dashboard_social_queue force  row level security;
drop policy if exists dashboard_social_queue_own on dashboard_social_queue;
create policy dashboard_social_queue_own on dashboard_social_queue
  for all
  using      (auth_user_id = auth.uid() and dashboard_is_allowed())
  with check (auth_user_id = auth.uid() and dashboard_is_allowed());

-- -------------------------------------------------------------
-- 2. MEDIA BUCKET
-- -------------------------------------------------------------
-- Public-read is a requirement, not a shortcut: Instagram's Content
-- Publishing API takes an `image_url` and fetches it from Meta's own
-- servers, with no credentials. A signed URL would work only until it
-- expired, and Meta re-fetches media on its own schedule.
--
-- The exposure is bounded and acceptable: the only things in this bucket
-- are images she is about to publish publicly anyway. Filenames are
-- UUIDs, so the bucket is not enumerable.
-- WHY THIS WHOLE SECTION IS WRAPPED IN AN EXCEPTION HANDLER
--
-- On some Supabase projects `storage.objects` is owned by
-- `supabase_storage_admin` rather than `postgres`, and CREATE POLICY on
-- it raises insufficient_privilege. Because this migration is applied
-- inside a single transaction, an unhandled error here would roll back
-- migrations 110 and 111 as well — the entire dashboard, defeated by an
-- image bucket.
--
-- So a failure is caught and reported as a NOTICE. Everything except
-- attaching media to a post still works, and the fix is one click in the
-- Storage UI (New bucket → personal-social → Public).
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'personal-social',
    'personal-social',
    true,
    104857600, -- 100 MB, comfortably above an Instagram video
    array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']
  )
  on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- WRITING to the bucket stays locked to allowlisted operators, and each
  -- of them only inside a folder named after their own user id.
  execute 'drop policy if exists personal_social_media_own on storage.objects';
  execute $p$
    create policy personal_social_media_own on storage.objects
      for all
      to authenticated
      using (
        bucket_id = 'personal-social'
        and dashboard_is_allowed()
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'personal-social'
        and dashboard_is_allowed()
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  raise notice 'personal-social storage bucket ready.';
exception
  when insufficient_privilege or undefined_table then
    raise notice
      'Could not configure the personal-social storage bucket (%). Everything else applied. Create it by hand: Storage -> New bucket -> name "personal-social" -> Public. Composing posts works; attaching photos will not until then.',
      sqlerrm;
end $$;

-- -------------------------------------------------------------
-- 3. AUDIENCE SNAPSHOTS  (follower-growth goals)
-- -------------------------------------------------------------
-- "Instagram +100 followers this month" needs a baseline, and Meta's API
-- only ever reports the CURRENT follower count. So it is sampled daily
-- and the goal is measured as (today − first sample of the period).
--
-- One row per platform per day: re-sampling on the same day overwrites
-- rather than accumulating.
create table if not exists dashboard_audience_snapshots (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  platform      text not null check (platform in ('instagram','facebook')),
  captured_on   date not null,
  followers     int not null default 0,
  posts_count   int not null default 0,
  created_at    timestamptz not null default now(),
  unique (auth_user_id, platform, captured_on)
);

create index if not exists dashboard_audience_recent
  on dashboard_audience_snapshots (auth_user_id, platform, captured_on desc);

alter table dashboard_audience_snapshots enable row level security;
alter table dashboard_audience_snapshots force  row level security;
drop policy if exists dashboard_audience_snapshots_own on dashboard_audience_snapshots;
create policy dashboard_audience_snapshots_own on dashboard_audience_snapshots
  for all
  using      (auth_user_id = auth.uid() and dashboard_is_allowed())
  with check (auth_user_id = auth.uid() and dashboard_is_allowed());

-- -------------------------------------------------------------
-- 4. GOALS — weekly periods
-- -------------------------------------------------------------
-- Migration 110 allowed 'month' and 'quarter'. A weekly lesson target
-- ("20 pamokų per savaitę") is one of the things she actually tracks, and
-- a month is too coarse to act on mid-week.
--
-- The constraint is dropped by its auto-generated name. `if exists`
-- makes this safe on a database where it was already replaced.
alter table dashboard_goals
  drop constraint if exists dashboard_goals_period_check;
alter table dashboard_goals
  add constraint dashboard_goals_period_check
  check (period in ('week', 'month', 'quarter'));

-- Grouping for the UI ('tjk' | 'longrein' | 'rinkodara'). Nullable and
-- untyped on purpose: it drives which heading a card sits under, and a
-- new grouping should not need a migration.
alter table dashboard_goals
  add column if not exists category text;

comment on table dashboard_social_queue is
  'Compose/schedule queue for social publishing. The WRITE side — dashboard_social_posts is the metrics read cache.';
comment on table dashboard_audience_snapshots is
  'Daily follower-count samples. Meta only reports the current count, so growth goals need a stored baseline.';

-- -------------------------------------------------------------
-- 5. TEARDOWN  (the "down" for this migration)
-- -------------------------------------------------------------
--   drop table if exists dashboard_social_queue;
--   drop table if exists dashboard_audience_snapshots;
--   drop policy if exists personal_social_media_own on storage.objects;
--   delete from storage.objects where bucket_id = 'personal-social';
--   delete from storage.buckets where id = 'personal-social';
--   alter table dashboard_goals drop column if exists category;
--   alter table dashboard_goals drop constraint if exists dashboard_goals_period_check;
--   alter table dashboard_goals add constraint dashboard_goals_period_check
--     check (period in ('month', 'quarter'));
--
-- Note the last two lines: reverting the period constraint will FAIL if
-- any weekly goals exist. Delete them first:
--   delete from dashboard_goals where period = 'week';


-- =============================================================
-- PART 4 of 4 - GRANT ACCESS
--
-- THIS is the feature flag. An empty dashboard_access table means
-- /personal returns 404 for everyone, including you.
--
-- The email must match the account you sign in to Longrein with. If the
-- verification table at the bottom comes back empty, that is the reason.
-- =============================================================

insert into dashboard_access (auth_user_id, label)
select id, 'Andreja - personal command centre'
  from auth.users
 where lower(email) = lower('darandaandreja@icloud.com')
on conflict (auth_user_id) do update set enabled = true;

commit;

-- -------------------------------------------------------------
-- VERIFICATION. Read both tables before closing the editor.
-- -------------------------------------------------------------

-- 1. Did every object get created?
select
  object_name,
  case when exists_now then 'ok' else 'MISSING' end as status
from (
  values
    ('dashboard_access',                to_regclass('public.dashboard_access')                is not null),
    ('dashboard_goals',                 to_regclass('public.dashboard_goals')                 is not null),
    ('dashboard_dismissals',            to_regclass('public.dashboard_dismissals')            is not null),
    ('dashboard_daily_briefings',       to_regclass('public.dashboard_daily_briefings')       is not null),
    ('dashboard_ai_recommendations',    to_regclass('public.dashboard_ai_recommendations')    is not null),
    ('dashboard_social_posts',          to_regclass('public.dashboard_social_posts')          is not null),
    ('dashboard_integration_settings',  to_regclass('public.dashboard_integration_settings')  is not null),
    ('dashboard_client_last_ride',      to_regclass('public.dashboard_client_last_ride')      is not null),
    ('dashboard_push_subscriptions',    to_regclass('public.dashboard_push_subscriptions')    is not null),
    ('dashboard_health_checks',         to_regclass('public.dashboard_health_checks')         is not null),
    ('dashboard_errors',                to_regclass('public.dashboard_errors')                is not null),
    ('founding_members',                to_regclass('public.founding_members')                is not null),
    ('dashboard_social_queue',          to_regclass('public.dashboard_social_queue')          is not null),
    ('dashboard_audience_snapshots',    to_regclass('public.dashboard_audience_snapshots')    is not null)
) as t(object_name, exists_now)
order by status desc, object_name;

-- 2. Who can reach /personal? Expect exactly ONE row - you.
--    Zero rows means the email above did not match any account: check it
--    against the address you actually log in with.
select
  u.email,
  a.enabled,
  a.label,
  a.created_at
from dashboard_access a
join auth.users u on u.id = a.auth_user_id
order by a.created_at;
