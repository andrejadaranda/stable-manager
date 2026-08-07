-- =============================================================
-- 113_health_check_minute_guard.sql
--
-- Enforce "at most one health check row per minute" in the DATABASE
-- rather than in the route handler.
--
-- WHY
-- /api/health is public (it has to be — external monitors can't
-- authenticate), and it recorded one row per request. The route had a
-- read-then-write guard: fetch the newest row, skip the insert if it is
-- under a minute old. In production that guard did not hold — five
-- requests two seconds apart produced five rows — and the same code
-- reproduced correctly against the same database from a laptop, so the
-- proximate cause was never established.
--
-- It does not need to be. A read-then-write check across concurrent
-- stateless lambdas is structurally racy: two requests can both read
-- "last row is 90s old" before either inserts. The application-level
-- guard was never going to be correct, only usually correct. A unique
-- index is correct always, under any concurrency, on any instance count.
--
-- The consequence of the bug was not just table growth: because uptime
-- is "pings received / pings expected", extra rows push the ratio up,
-- and computeUptime() caps at 100%. So anyone hitting the endpoint in a
-- loop could pin the uptime card at a permanent, meaningless 100% —
-- which is precisely the comfortable-but-false number this whole design
-- was built to avoid.
--
-- Additive and idempotent. Teardown at the bottom.
-- =============================================================

-- A stored generated column, because an index expression must be
-- IMMUTABLE and `date_trunc(text, timestamptz)` is only STABLE — it
-- depends on the session TimeZone. Pinning the zone with
-- `at time zone 'UTC'` yields a plain `timestamp` and an IMMUTABLE
-- expression, which can be indexed.
alter table dashboard_health_checks
  add column if not exists checked_minute timestamp
  generated always as (date_trunc('minute', (checked_at at time zone 'UTC'))) stored;

-- Collapse any existing duplicates before the unique index goes on,
-- keeping the earliest row in each minute. Without this the CREATE
-- INDEX below fails on a database that already accumulated them —
-- which is every database this is being applied to.
delete from dashboard_health_checks a
 using dashboard_health_checks b
 where a.checked_minute = b.checked_minute
   and a.id > b.id;

create unique index if not exists dashboard_health_checks_one_per_minute
  on dashboard_health_checks (checked_minute);

comment on index dashboard_health_checks_one_per_minute is
  'At most one probe row per minute. The route inserts unconditionally and ignores the duplicate-key error; this index is the actual throttle.';

-- -------------------------------------------------------------
-- TEARDOWN
-- -------------------------------------------------------------
--   drop index if exists dashboard_health_checks_one_per_minute;
--   alter table dashboard_health_checks drop column if exists checked_minute;
