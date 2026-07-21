-- 105_billable_items_view.sql
-- Unified billing read-model. One normalized shape over every money-owed
-- source (lessons, horse boarding, misc client charges, prepaid packages) that
-- all finance features read from. Status is DERIVED live (scheduled -> delivered
-- as the date passes; -> paid as payments accumulate). Excludes price=0 lessons
-- (drops free + package-covered lessons, preventing package double-counting).
-- security_invoker => underlying-table RLS applies to every read.
-- Applied to live DB dluxzjphpokzkrwmmibe 2026-07-20.

create or replace view billable_items as
select
  'lesson'::text as item_type, l.id as source_id, l.stable_id, l.client_id, l.horse_id,
  'Lesson'::text as title, l.price as amount,
  coalesce((select sum(p.amount) from payments p where p.lesson_id = l.id), 0) as paid_amount,
  (l.starts_at)::date as occurs_on, false as is_reimbursement,
  case
    when l.status = 'cancelled' then 'cancelled'
    when l.status = 'scheduled' then 'scheduled'
    when coalesce((select sum(p.amount) from payments p where p.lesson_id = l.id), 0) >= l.price then 'paid'
    else 'delivered'
  end as status,
  exists (select 1 from invoice_items ii where ii.lesson_id = l.id) as invoiced
from lessons l
where l.client_id is not null and l.price > 0

union all
select
  'boarding', b.id, b.stable_id, b.owner_client_id, b.horse_id,
  coalesce(b.period_label, 'Boarding'), b.amount,
  coalesce((select sum(p.amount) from payments p where p.boarding_charge_id = b.id), 0),
  b.period_start, false,
  case
    when coalesce((select sum(p.amount) from payments p where p.boarding_charge_id = b.id), 0) >= b.amount then 'paid'
    when b.period_start <= current_date then 'delivered'
    else 'scheduled'
  end,
  exists (select 1 from invoice_items ii where ii.boarding_charge_id = b.id)
from horse_boarding_charges b
where b.owner_client_id is not null

union all
select
  'charge', c.id, c.stable_id, c.client_id, c.horse_id,
  coalesce(c.custom_label, c.kind::text), c.amount,
  coalesce((select sum(p.amount) from payments p where p.client_charge_id = c.id), 0),
  c.incurred_on,
  (c.kind in ('farrier','vet_copay','equipment','transport','supplement')),
  case
    when coalesce((select sum(p.amount) from payments p where p.client_charge_id = c.id), 0) >= c.amount then 'paid'
    else 'delivered'
  end,
  exists (select 1 from invoice_items ii where ii.client_charge_id = c.id)
from client_charges c

union all
select
  'package', pk.id, pk.stable_id, pk.client_id, null::uuid,
  'Lesson package', pk.price,
  coalesce((select sum(p.amount) from payments p where p.package_id = pk.id), 0),
  (pk.purchased_at)::date, false,
  case
    when coalesce((select sum(p.amount) from payments p where p.package_id = pk.id), 0) >= pk.price then 'paid'
    else 'delivered'
  end,
  false
from lesson_packages pk;

alter view billable_items set (security_invoker = true);
