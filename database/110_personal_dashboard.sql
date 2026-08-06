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
