-- 109_group_balance_per_participant.sql
-- FIX: a group ("būrelis") lesson billed the WHOLE club total to the single
-- payer (lessons.client_id) while each child paid separately via
-- payments.lesson_participant_id — so the payer showed a debt for everyone
-- (e.g. Erika Mažonė −€250) and each child showed a credit. Now group lessons
-- are charged PER confirmed participant (each child their own share), matched
-- against that child's participant payments. Individual lessons unchanged.
-- Applied to live DB dluxzjphpokzkrwmmibe 2026-08-06.

-- 1) client_account_summary view (Clients list balance). security_invoker=on
--    preserved so per-stable RLS still applies.
create or replace view client_account_summary
with (security_invoker = on) as
select
  c.id       as client_id,
  c.stable_id,
  c.full_name,
  coalesce(ind.amount,0) + coalesce(grp.amount,0) + coalesce(misc.amount,0) + coalesce(boarding.amount,0) as total_charged,
  coalesce(paid.amount,0) as total_paid,
  coalesce(paid.amount,0)
    - (coalesce(ind.amount,0) + coalesce(grp.amount,0) + coalesce(misc.amount,0) + coalesce(boarding.amount,0)) as balance
from clients c
left join (
  select client_id, sum(price) as amount
  from lessons
  where status = any (array['completed'::lesson_status,'no_show'::lesson_status])
    and lesson_type is distinct from 'group'
  group by client_id
) ind on ind.client_id = c.id
left join (
  select lp.client_id, sum(lp.price) as amount
  from lesson_participants lp
  join lessons l on l.id = lp.lesson_id
  where l.status = any (array['completed'::lesson_status,'no_show'::lesson_status])
    and l.lesson_type = 'group'
    and lp.status = 'confirmed'
  group by lp.client_id
) grp on grp.client_id = c.id
left join (
  select client_id, sum(amount) as amount from client_charges group by client_id
) misc on misc.client_id = c.id
left join (
  select owner_client_id as client_id, sum(amount) as amount
  from horse_boarding_charges group by owner_client_id
) boarding on boarding.client_id = c.id
left join (
  select client_id, sum(amount) as amount from payments group by client_id
) paid on paid.client_id = c.id;

-- 2) client_balance(p_client_id) RPC (client profile balance) — same split.
create or replace function public.client_balance(p_client_id uuid)
returns numeric
language sql
stable
set search_path to 'public','pg_temp'
as $function$
  with charges as (
    select coalesce(sum(price), 0) as total
    from lessons
    where client_id = p_client_id
      and status in ('completed','no_show')
      and lesson_type is distinct from 'group'
  ),
  grp as (
    select coalesce(sum(lp.price), 0) as total
    from lesson_participants lp
    join lessons l on l.id = lp.lesson_id
    where lp.client_id = p_client_id
      and l.status in ('completed','no_show')
      and l.lesson_type = 'group'
      and lp.status = 'confirmed'
  ),
  misc as (
    select coalesce(sum(amount), 0) as total from client_charges where client_id = p_client_id
  ),
  boarding as (
    select coalesce(sum(amount), 0) as total from horse_boarding_charges where owner_client_id = p_client_id
  ),
  paid as (
    select coalesce(sum(amount), 0) as total from payments where client_id = p_client_id
  )
  select (paid.total - charges.total - grp.total - misc.total - boarding.total)::numeric
  from charges, grp, misc, boarding, paid;
$function$;

-- 3) services/payments.ts listClientOwedItems now skips group lessons for the
--    payer (they are billed per participant, managed in the calendar's
--    per-rider panel), so the payer no longer shows the club total as owed.
