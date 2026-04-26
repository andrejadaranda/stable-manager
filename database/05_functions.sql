-- =============================================================
-- 05_functions.sql
-- Business-logic functions and the client account view.
-- All run as SECURITY INVOKER (default) so RLS still applies.
-- =============================================================

-- -------------------------------------------------------------
-- horse_workload: lessons + total minutes ridden in [from, to)
-- -------------------------------------------------------------
create or replace function horse_workload(
  p_horse_id uuid,
  p_from     timestamptz,
  p_to       timestamptz
) returns table (total_lessons bigint, total_minutes bigint)
language sql stable as $$
  select
    count(*)::bigint,
    coalesce(sum(extract(epoch from (ends_at - starts_at)) / 60), 0)::bigint
  from lessons
  where horse_id = p_horse_id
    and status in ('scheduled', 'completed')
    and starts_at >= p_from
    and starts_at <  p_to;
$$;

-- -------------------------------------------------------------
-- horse_is_overworked: daily/weekly cap status for a given date
-- -------------------------------------------------------------
create or replace function horse_is_overworked(p_horse_id uuid, p_on date)
returns table (
  daily_count   bigint,
  daily_limit   int,
  weekly_count  bigint,
  weekly_limit  int,
  over_daily    boolean,
  over_weekly   boolean
) language sql stable as $$
  with h as (
    select daily_lesson_limit, weekly_lesson_limit from horses where id = p_horse_id
  ),
  d as (
    select count(*)::bigint c from lessons
    where horse_id = p_horse_id
      and status in ('scheduled','completed')
      and starts_at::date = p_on
  ),
  w as (
    select count(*)::bigint c from lessons
    where horse_id = p_horse_id
      and status in ('scheduled','completed')
      and starts_at >= date_trunc('week', p_on::timestamptz)
      and starts_at <  date_trunc('week', p_on::timestamptz) + interval '7 days'
  )
  select d.c, h.daily_lesson_limit,
         w.c, h.weekly_lesson_limit,
         d.c >= h.daily_lesson_limit,
         w.c >= h.weekly_lesson_limit
  from h, d, w;
$$;

-- -------------------------------------------------------------
-- client_balance (no subscriptions in MVP)
--   negative => client owes money
--   positive => client has credit
-- -------------------------------------------------------------
create or replace function client_balance(p_client_id uuid)
returns numeric language sql stable as $$
  with charges as (
    select coalesce(sum(price), 0) as total
    from lessons
    where client_id = p_client_id
      and status in ('scheduled', 'completed')
  ),
  paid as (
    select coalesce(sum(amount), 0) as total
    from payments
    where client_id = p_client_id
  )
  select (paid.total - charges.total)::numeric from charges, paid;
$$;

-- -------------------------------------------------------------
-- check_horse_available: friendly preflight before insert.
-- The exclusion constraint on `lessons` is the source of truth;
-- this function exists so the service layer can return a clean
-- error message before attempting the write.
-- -------------------------------------------------------------
create or replace function check_horse_available(
  p_horse_id        uuid,
  p_starts_at       timestamptz,
  p_ends_at         timestamptz,
  p_exclude_lesson  uuid default null
) returns boolean language sql stable as $$
  select not exists (
    select 1 from lessons
    where horse_id = p_horse_id
      and status in ('scheduled', 'completed')
      and (p_exclude_lesson is null or id <> p_exclude_lesson)
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  );
$$;

-- -------------------------------------------------------------
-- client_account_summary view
-- security_invoker = true => underlying tables' RLS applies.
-- -------------------------------------------------------------
create or replace view client_account_summary
with (security_invoker = true) as
select
  c.id                                                       as client_id,
  c.stable_id,
  c.full_name,
  coalesce(charges.amount, 0)                                as total_charged,
  coalesce(paid.amount, 0)                                   as total_paid,
  coalesce(paid.amount, 0) - coalesce(charges.amount, 0)     as balance
from clients c
left join (
  select client_id, sum(price) as amount
  from lessons
  where status in ('scheduled','completed')
  group by client_id
) charges on charges.client_id = c.id
left join (
  select client_id, sum(amount) as amount
  from payments
  group by client_id
) paid on paid.client_id = c.id;

-- Grants
grant execute on function horse_workload(uuid, timestamptz, timestamptz)              to authenticated;
grant execute on function horse_is_overworked(uuid, date)                             to authenticated;
grant execute on function client_balance(uuid)                                        to authenticated;
grant execute on function check_horse_available(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant select   on client_account_summary                                              to authenticated;
