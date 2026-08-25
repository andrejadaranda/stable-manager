-- 110_credit_payment_method.sql
-- "Pay from account credit": when a client has overpaid (surplus stored as a
-- lesson-less payment = their credit), the owner can settle a future lesson
-- FROM that credit. A credit application is recorded as a payment with
-- method='credit' linked to the lesson — the lesson flips to paid, but it is
-- NOT new cash, so it must be excluded from total_paid in the balance views
-- (otherwise it would double-count and inflate the balance).
-- Applied to live DB dluxzjphpokzkrwmmibe 2026-08-07.

-- 1) New payment method.
alter type payment_method add value if not exists 'credit';

-- 2) Balance view + RPC: total_paid counts real cash only (method <> 'credit').
--    (Kept the group-per-participant charge split from migration 109.)
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
  select client_id, sum(price) as amount from lessons
  where status = any (array['completed'::lesson_status,'no_show'::lesson_status])
    and lesson_type is distinct from 'group'
  group by client_id
) ind on ind.client_id = c.id
left join (
  select lp.client_id, sum(lp.price) as amount
  from lesson_participants lp join lessons l on l.id = lp.lesson_id
  where l.status = any (array['completed'::lesson_status,'no_show'::lesson_status])
    and l.lesson_type = 'group' and lp.status = 'confirmed'
  group by lp.client_id
) grp on grp.client_id = c.id
left join ( select client_id, sum(amount) as amount from client_charges group by client_id ) misc on misc.client_id = c.id
left join ( select owner_client_id as client_id, sum(amount) as amount from horse_boarding_charges group by owner_client_id ) boarding on boarding.client_id = c.id
left join (
  select client_id, sum(amount) filter (where method <> 'credit') as amount
  from payments group by client_id
) paid on paid.client_id = c.id;

create or replace function public.client_balance(p_client_id uuid)
returns numeric language sql stable set search_path to 'public','pg_temp'
as $function$
  with charges as (
    select coalesce(sum(price),0) as total from lessons
    where client_id = p_client_id and status in ('completed','no_show') and lesson_type is distinct from 'group'
  ),
  grp as (
    select coalesce(sum(lp.price),0) as total
    from lesson_participants lp join lessons l on l.id = lp.lesson_id
    where lp.client_id = p_client_id and l.status in ('completed','no_show')
      and l.lesson_type = 'group' and lp.status = 'confirmed'
  ),
  misc as ( select coalesce(sum(amount),0) as total from client_charges where client_id = p_client_id ),
  boarding as ( select coalesce(sum(amount),0) as total from horse_boarding_charges where owner_client_id = p_client_id ),
  paid as ( select coalesce(sum(amount),0) as total from payments where client_id = p_client_id and method <> 'credit' )
  select (paid.total - charges.total - grp.total - misc.total - boarding.total)::numeric
  from charges, grp, misc, boarding, paid;
$function$;

-- 3) App: services/payments.ts getClientAvailableCredit() = unallocated real
--    payments − credit already applied. payLessonWithCreditAction records the
--    credit payment; edit-lesson dialog shows a "Use credit (€X)" button.
