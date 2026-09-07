-- 115_balance_packages_and_future_charges.sql
--
-- Two balance-accuracy fixes surfaced by real use (TJK):
--
-- 1) PACKAGES ARE A CHARGE. A bought package (e.g. x8 for €230) is money the
--    client owes for; paying it — cash OR from credit — should net the balance
--    to zero. Before this, the package PRICE was never on the "charged" side,
--    so:
--      * a cash package buyer showed +€230 phantom "in credit", and
--      * paying a package from credit drew the credit down but left the
--        balance showing the old +€230 (Justina Krasnigoraitė: credit €0 yet
--        profile said "€230 in credit").
--    Fix: add sum(lesson_packages.price) to charged. And EXCLUDE package-
--    covered lessons (lessons.package_id not null) from the per-lesson charge,
--    otherwise a lesson drawn from a package would be billed twice (once via
--    the package, once via its own price).
--
-- 2) FUTURE-DATED CHARGES ARE NOT OWED YET. A misc charge entered ahead of
--    time (e.g. a farrier reimbursement dated for the visit that hasn't
--    happened) must not count as "owes" until its date arrives — same rule the
--    app already applies to lessons (only delivered ones are charged). Fix:
--    only count client_charges with incurred_on <= today (Europe/Vilnius).
--
-- Mirrors migration 110's structure; keeps the group-per-participant split
-- (109) and credit exclusion (110). Applied to live DB dluxzjphpokzkrwmmibe.

-- ---- Clients-list balance view --------------------------------------------
create or replace view client_account_summary
with (security_invoker = on) as
select
  c.id       as client_id,
  c.stable_id,
  c.full_name,
  coalesce(ind.amount,0) + coalesce(grp.amount,0) + coalesce(misc.amount,0)
    + coalesce(boarding.amount,0) + coalesce(pkg.amount,0) as total_charged,
  coalesce(paid.amount,0) as total_paid,
  coalesce(paid.amount,0)
    - (coalesce(ind.amount,0) + coalesce(grp.amount,0) + coalesce(misc.amount,0)
       + coalesce(boarding.amount,0) + coalesce(pkg.amount,0)) as balance
from clients c
left join (
  -- individual delivered lessons NOT covered by a package
  select client_id, sum(price) as amount from lessons
  where status = any (array['completed'::lesson_status,'no_show'::lesson_status])
    and lesson_type is distinct from 'group'
    and package_id is null
  group by client_id
) ind on ind.client_id = c.id
left join (
  select lp.client_id, sum(lp.price) as amount
  from lesson_participants lp join lessons l on l.id = lp.lesson_id
  where l.status = any (array['completed'::lesson_status,'no_show'::lesson_status])
    and l.lesson_type = 'group' and lp.status = 'confirmed'
  group by lp.client_id
) grp on grp.client_id = c.id
left join (
  -- misc charges that are actually due (not future-dated)
  select client_id, sum(amount) as amount from client_charges
  where incurred_on <= (now() at time zone 'Europe/Vilnius')::date
  group by client_id
) misc on misc.client_id = c.id
left join (
  select owner_client_id as client_id, sum(amount) as amount
  from horse_boarding_charges group by owner_client_id
) boarding on boarding.client_id = c.id
left join (
  -- packages bought are a charge (prepaid value the client owes for)
  select client_id, sum(price) as amount from lesson_packages group by client_id
) pkg on pkg.client_id = c.id
left join (
  select client_id, sum(amount) filter (where method <> 'credit') as amount
  from payments group by client_id
) paid on paid.client_id = c.id;

-- ---- Client-profile balance RPC -------------------------------------------
create or replace function public.client_balance(p_client_id uuid)
returns numeric language sql stable set search_path to 'public','pg_temp'
as $function$
  with charges as (
    select coalesce(sum(price),0) as total from lessons
    where client_id = p_client_id and status in ('completed','no_show')
      and lesson_type is distinct from 'group' and package_id is null
  ),
  grp as (
    select coalesce(sum(lp.price),0) as total
    from lesson_participants lp join lessons l on l.id = lp.lesson_id
    where lp.client_id = p_client_id and l.status in ('completed','no_show')
      and l.lesson_type = 'group' and lp.status = 'confirmed'
  ),
  misc as (
    select coalesce(sum(amount),0) as total from client_charges
    where client_id = p_client_id
      and incurred_on <= (now() at time zone 'Europe/Vilnius')::date
  ),
  boarding as (
    select coalesce(sum(amount),0) as total from horse_boarding_charges where owner_client_id = p_client_id
  ),
  pkg as (
    select coalesce(sum(price),0) as total from lesson_packages where client_id = p_client_id
  ),
  paid as (
    select coalesce(sum(amount),0) as total from payments
    where client_id = p_client_id and method <> 'credit'
  )
  select (paid.total - charges.total - grp.total - misc.total - boarding.total - pkg.total)::numeric
  from charges, grp, misc, boarding, pkg, paid;
$function$;

notify pgrst, 'reload schema';
