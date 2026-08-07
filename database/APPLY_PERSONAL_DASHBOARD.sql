-- =============================================================
-- APPLY_PERSONAL_DASHBOARD.sql
--
-- ONE PASTE. Turns the private command centre at /personal on.
--
-- HOW TO RUN
--   1. supabase.com/dashboard → the Longrein project → SQL Editor
--   2. New query → paste this entire file → Run
--   3. Read the two result tables printed at the end. Both must be green:
--        · "objects created"  — every row should say ok
--        · "access granted"   — must show exactly one row, your account
--
-- WHAT IT DOES
--   · runs migration 110 (dashboard tables, RLS, the last-ride view)
--   · runs migration 111 (push, health checks, error log, founding members)
--   · adds YOUR account to dashboard_access, which is the feature flag
--
-- SAFE TO RE-RUN. Every statement is idempotent, and nothing here alters
-- a single existing Longrein table, policy, function or enum. Running it
-- twice changes nothing.
--
-- TO SWITCH THE WHOLE THING OFF AGAIN (instant, no deploy):
--   update dashboard_access set enabled = false;
-- =============================================================

begin;

-- -------------------------------------------------------------
-- Guard: this file assumes migrations 110 and 111 have been pasted
-- into the SQL Editor in order, OR that you are pasting this file
-- INSTEAD of them. Either way the objects below must exist before the
-- allowlist row can be inserted, so fail loudly rather than half-apply.
-- -------------------------------------------------------------
do $$
begin
  if to_regclass('public.dashboard_access') is null then
    raise exception
      'dashboard_access is missing. Paste database/110_personal_dashboard.sql first, then database/111_personal_dashboard_ops.sql, then re-run this file.';
  end if;
  if to_regclass('public.founding_members') is null then
    raise exception
      'founding_members is missing. Paste database/111_personal_dashboard_ops.sql, then re-run this file.';
  end if;
end $$;

-- -------------------------------------------------------------
-- Grant access. THIS is the feature flag: an empty dashboard_access
-- table means /personal 404s for everyone, including you.
--
-- The email must match the account you sign in to Longrein with.
-- -------------------------------------------------------------
insert into dashboard_access (auth_user_id, label)
select id, 'Andreja — personal command centre'
  from auth.users
 where lower(email) = lower('darandaandreja@icloud.com')
on conflict (auth_user_id) do update set enabled = true;

commit;

-- -------------------------------------------------------------
-- Verification. Read these two tables before closing the editor.
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
    ('founding_members',                to_regclass('public.founding_members')                is not null)
) as t(object_name, exists_now)
order by status desc, object_name;

-- 2. Who can reach /personal? Expect exactly one row — you.
--    Zero rows means the email above did not match any account: check
--    the spelling against the address you actually log in with.
select
  u.email,
  a.enabled,
  a.label,
  a.created_at
from dashboard_access a
join auth.users u on u.id = a.auth_user_id
order by a.created_at;
