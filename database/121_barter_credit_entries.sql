-- =============================================================
-- 121_barter_credit_entries.sql
--
-- Barter / work-for-credit ledger. The owner logs work a client's person
-- (e.g. a relative) does for the stable — date, what they did, and the EUR
-- amount that converts into stable CREDIT for that client. That credit is
-- then spent on services the normal way (a payment with method='credit'
-- linked to the lesson/charge), which already shows as "credit used" in the
-- account statement.
--
-- Money model (must stay exact, zero errors):
--   balance = cash_paid + barter_credit − charges
--   total_paid stays CASH ONLY (method<>'credit'); barter is a separate
--   credit source added to the balance, never double-counted. Credit spent
--   (method='credit') is already excluded from total_paid, so applying it
--   doesn't move the balance — it just draws down the credit pool.
--
-- Applied to live DB dluxzjphpokzkrwmmibe. Idempotent.
-- =============================================================

create table if not exists client_credit_entries (
  id          uuid primary key default gen_random_uuid(),
  stable_id   uuid not null references stables(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete restrict,
  entry_date  date not null default current_date,
  description text not null,
  amount      numeric(10,2) not null check (amount > 0),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists cce_client_date_idx
  on client_credit_entries (stable_id, client_id, entry_date desc);

-- Same-stable integrity: the client must belong to the row's stable.
create or replace function client_credit_entries_enforce_same_stable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from clients c where c.id = new.client_id and c.stable_id = new.stable_id) then
    raise exception 'client_credit_entries: client % is not in stable %', new.client_id, new.stable_id;
  end if;
  return new;
end $$;

drop trigger if exists cce_same_stable on client_credit_entries;
create trigger cce_same_stable before insert or update on client_credit_entries
  for each row execute function client_credit_entries_enforce_same_stable();

drop trigger if exists cce_set_updated on client_credit_entries;
create trigger cce_set_updated before update on client_credit_entries
  for each row execute function set_updated_at();

alter table client_credit_entries enable row level security;
alter table client_credit_entries force  row level security;

drop policy if exists cce_read_staff on client_credit_entries;
create policy cce_read_staff on client_credit_entries for select
  using (stable_id = current_stable_id() and current_user_role() in ('owner','employee'));

drop policy if exists cce_read_self on client_credit_entries;
create policy cce_read_self on client_credit_entries for select
  using (stable_id = current_stable_id() and client_id = current_client_id());

drop policy if exists cce_write_owner on client_credit_entries;
create policy cce_write_owner on client_credit_entries for all
  using (stable_id = current_stable_id() and current_user_role() = 'owner')
  with check (stable_id = current_stable_id() and current_user_role() = 'owner');

-- ---------- balance: add barter credit to the credit side ----------
create or replace function public.client_balance(p_client_id uuid)
 returns numeric
 language sql
 stable
 set search_path to 'public', 'pg_temp'
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
  barter as (
    select coalesce(sum(amount),0) as total from client_credit_entries where client_id = p_client_id
  ),
  paid as (
    select coalesce(sum(amount),0) as total from payments
    where client_id = p_client_id and method <> 'credit'
  )
  select (paid.total + barter.total - charges.total - grp.total - misc.total - boarding.total - pkg.total)::numeric
  from charges, grp, misc, boarding, pkg, barter, paid;
$function$;

-- ---------- summary view: total_paid = cash only; balance includes barter ----------
create or replace view public.client_account_summary
with (security_invoker = on) as
 SELECT c.id AS client_id,
    c.stable_id,
    c.full_name,
    COALESCE(ind.amount, 0::numeric) + COALESCE(grp.amount, 0::numeric) + COALESCE(misc.amount, 0::numeric) + COALESCE(boarding.amount, 0::numeric) + COALESCE(pkg.amount, 0::numeric) AS total_charged,
    COALESCE(paid.amount, 0::numeric) AS total_paid,
    (COALESCE(paid.amount, 0::numeric) + COALESCE(barter.amount, 0::numeric)) - (COALESCE(ind.amount, 0::numeric) + COALESCE(grp.amount, 0::numeric) + COALESCE(misc.amount, 0::numeric) + COALESCE(boarding.amount, 0::numeric) + COALESCE(pkg.amount, 0::numeric)) AS balance
   FROM clients c
     LEFT JOIN ( SELECT lessons.client_id, sum(lessons.price) AS amount
           FROM lessons
          WHERE (lessons.status = ANY (ARRAY['completed'::lesson_status, 'no_show'::lesson_status])) AND lessons.lesson_type IS DISTINCT FROM 'group'::text AND lessons.package_id IS NULL
          GROUP BY lessons.client_id) ind ON ind.client_id = c.id
     LEFT JOIN ( SELECT lp.client_id, sum(lp.price) AS amount
           FROM lesson_participants lp JOIN lessons l ON l.id = lp.lesson_id
          WHERE (l.status = ANY (ARRAY['completed'::lesson_status, 'no_show'::lesson_status])) AND l.lesson_type = 'group'::text AND lp.status = 'confirmed'::text
          GROUP BY lp.client_id) grp ON grp.client_id = c.id
     LEFT JOIN ( SELECT client_charges.client_id, sum(client_charges.amount) AS amount
           FROM client_charges
          WHERE client_charges.incurred_on <= (now() AT TIME ZONE 'Europe/Vilnius'::text)::date
          GROUP BY client_charges.client_id) misc ON misc.client_id = c.id
     LEFT JOIN ( SELECT horse_boarding_charges.owner_client_id AS client_id, sum(horse_boarding_charges.amount) AS amount
           FROM horse_boarding_charges
          GROUP BY horse_boarding_charges.owner_client_id) boarding ON boarding.client_id = c.id
     LEFT JOIN ( SELECT lesson_packages.client_id, sum(lesson_packages.price) AS amount
           FROM lesson_packages
          GROUP BY lesson_packages.client_id) pkg ON pkg.client_id = c.id
     LEFT JOIN ( SELECT client_credit_entries.client_id, sum(client_credit_entries.amount) AS amount
           FROM client_credit_entries
          GROUP BY client_credit_entries.client_id) barter ON barter.client_id = c.id
     LEFT JOIN ( SELECT payments.client_id, sum(payments.amount) FILTER (WHERE payments.method <> 'credit'::payment_method) AS amount
           FROM payments
          GROUP BY payments.client_id) paid ON paid.client_id = c.id;
