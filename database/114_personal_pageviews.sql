-- =============================================================
-- 114_personal_pageviews.sql
--
-- First-party traffic counting: "kas kiek lankosi".
--
-- WHY NOT A THIRD PARTY
-- Vercel Web Analytics, Google Analytics and Plausible all need an API
-- credential in an environment variable, and the operator cannot add
-- one — that constraint is the whole reason this exists. Counting into
-- her own database needs no credential at all: the dashboard already
-- reads this Postgres, so the numbers are simply there.
--
-- Checked before building: tjk.lt has no analytics of any kind (no GA,
-- no GTM, no Matomo), and Vercel Web Analytics is not enabled on the
-- project. So there was no existing data to read — something had to
-- start counting.
--
-- WHAT IS AND IS NOT STORED
-- One row per (day, host, path) with two counters. No IP, no user
-- agent, no cookie, no identifier of any kind. Nothing written here
-- could identify a visitor, which is what keeps it outside consent-banner
-- territory and free of any retention obligation.
--
-- "Views" is every page load. "Visits" is counted once per browser
-- session, decided client-side with sessionStorage — the server never
-- learns who, only that one more session began.
--
-- Applied to production via the Supabase MCP; this file is the
-- source-of-truth copy. Additive and idempotent. Teardown at the bottom.
-- =============================================================

create table if not exists dashboard_pageviews (
  id           bigserial primary key,
  host         text not null,
  path         text not null,
  viewed_on    date not null,
  views        integer not null default 0,
  visits       integer not null default 0,
  updated_at   timestamptz not null default now(),
  unique (host, path, viewed_on)
);

create index if not exists dashboard_pageviews_recent
  on dashboard_pageviews (viewed_on desc, host);

-- Service-role only, like dashboard_health_checks and dashboard_errors:
-- written by the public beacon endpoint through the admin client, read
-- by the dashboard through the admin client. No browser session ever
-- touches this table directly, so RLS-on-with-no-policy is exactly right.
alter table dashboard_pageviews enable row level security;
alter table dashboard_pageviews force  row level security;

comment on table dashboard_pageviews is
  'First-party traffic counters. No IP, user agent, cookie or visitor identifier is stored — only per-day totals per path.';

-- -------------------------------------------------------------
-- Atomic increment
-- -------------------------------------------------------------
-- An RPC rather than read-modify-write in the route, for exactly the
-- reason the health-check throttle had to move into the database:
-- concurrent requests racing a read-then-write silently lose counts, and
-- a traffic counter that undercounts under load is worse than no counter,
-- because it looks authoritative.
create or replace function dashboard_record_pageview(
  p_host text,
  p_path text,
  p_day  date,
  p_is_visit boolean
) returns void
language sql
security definer
set search_path = public
as $$
  insert into dashboard_pageviews (host, path, viewed_on, views, visits, updated_at)
  values (p_host, p_path, p_day, 1, case when p_is_visit then 1 else 0 end, now())
  on conflict (host, path, viewed_on) do update
    set views      = dashboard_pageviews.views + 1,
        visits     = dashboard_pageviews.visits + case when p_is_visit then 1 else 0 end,
        updated_at = now();
$$;

-- The beacon endpoint is public by necessity (it has to work from
-- tjk.lt, a different origin entirely), so this function is the only
-- write path into the table. It can do exactly one thing: add one to a
-- counter. It cannot read, cannot touch another table, and returns
-- nothing that could be used to probe the database.
revoke all on function dashboard_record_pageview(text, text, date, boolean) from public;
grant execute on function dashboard_record_pageview(text, text, date, boolean) to service_role;

-- -------------------------------------------------------------
-- TEARDOWN
-- -------------------------------------------------------------
--   drop function if exists dashboard_record_pageview(text, text, date, boolean);
--   drop table if exists dashboard_pageviews;
