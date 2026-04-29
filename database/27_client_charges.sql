-- =============================================================
-- 27_client_charges.sql
--
-- Generic per-client charge ledger. Anything that isn't a lesson, a
-- package, or a recurring boarding period — farrier visit, equipment
-- repair, extra hay, vet co-pay, transport, etc. The owner records
-- one row, and the client sees it in their portal balance.
--
-- Optional `horse_id` link surfaces the charge on the horse profile
-- too (so the boarder's horse page shows "Farrier Apr 5 — €40").
-- Settled the same way as boarding charges: a payments row with
-- payments.client_charge_id = the charge id.
--
-- Updates client_balance() to debit these charges so the existing
-- "X owes / X credit" UI stays correct without per-screen changes.
--
-- RLS:
--   * read   : staff (owner+employee) for the whole stable;
--              client reads their own.
--   * write  : OWNER only.
-- =============================================================

create type client_charge_kind as enum (
  'farrier',
  'equipment',
  'supplement',
  'vet_copay',
  'transport',
  'training_extra',
  'other'
);

create table client_charges (
  id            uuid primary key default gen_random_uuid(),
  stable_id     uuid not null references stables(id) on delete cascade,
  client_id     uuid not null references clients(id) on delete restrict,
  -- Optional — surfaces the charge on the horse profile too.
  horse_id      uuid references horses(id) on delete set null,
  kind          client_charge_kind not null,
  -- Free-form when kind='other' (e.g. "Stall mat repair").
  custom_label  text,
  amount        numeric(10,2) not null check (amount > 0),
  incurred_on   date not null default current_date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on client_charges(stable_id, client_id, incurred_on desc);
create index on client_charges(stable_id, horse_id, incurred_on desc) where horse_id is not null;

create trigger trg_client_charges_updated
  before update on client_charges
  for each row execute function set_updated_at();

-- ---------------- COLUMNS ON EXISTING TABLES ----------------
alter table payments
  add column client_charge_id uuid references client_charges(id) on delete set null;
create index on payments(client_charge_id) where client_charge_id is not null;

-- ---------------- SAME-STABLE ENFORCEMENT ----------------
create or replace function client_charges_enforce_same_stable() returns trigger
language plpgsql as $$
declare s uuid;
begin
  select stable_id into s from clients where id = new.client_id;
  if s is null or s <> new.stable_id then
    raise exception 'client_charges.client_id must belong to the same stable';
  end if;
  if new.horse_id is not null then
    select stable_id into s from horses where id = new.horse_id;
    if s is null or s <> new.stable_id then
      raise exception 'client_charges.horse_id must belong to the same stable';
    end if;
  end if;
  return new;
end $$;

create trigger client_charges_same_stable
  before insert or update on client_charges
  for each row execute function client_charges_enforce_same_stable();

-- Extend payments same-stable trigger so client_charge_id (when set)
-- belongs to the same stable + client as the payment.
create or replace function payments_enforce_same_stable() returns trigger
language plpgsql as $$
declare c_stable uuid; l_stable uuid; l_client uuid;
        p_stable uuid; p_client uuid;
        b_stable uuid; b_client uuid;
        cc_stable uuid; cc_client uuid;
begin
  select stable_id into c_stable from clients where id = new.client_id;
  if c_stable is null or c_stable <> new.stable_id then
    raise exception 'client % does not belong to stable %', new.client_id, new.stable_id; end if;

  if new.lesson_id is not null then
    select stable_id, client_id into l_stable, l_client from lessons where id = new.lesson_id;
    if l_stable is null or l_stable <> new.stable_id then
      raise exception 'lesson % does not belong to stable %', new.lesson_id, new.stable_id; end if;
    if l_client <> new.client_id then
      raise exception 'lesson % belongs to a different client', new.lesson_id; end if;
  end if;

  if new.package_id is not null then
    select stable_id, client_id into p_stable, p_client
      from lesson_packages where id = new.package_id;
    if p_stable is null or p_stable <> new.stable_id then
      raise exception 'package % does not belong to stable %', new.package_id, new.stable_id; end if;
    if p_client <> new.client_id then
      raise exception 'package % belongs to a different client', new.package_id; end if;
  end if;

  if new.boarding_charge_id is not null then
    select stable_id, owner_client_id into b_stable, b_client
      from horse_boarding_charges where id = new.boarding_charge_id;
    if b_stable is null or b_stable <> new.stable_id then
      raise exception 'boarding charge % does not belong to stable %', new.boarding_charge_id, new.stable_id; end if;
    if b_client <> new.client_id then
      raise exception 'boarding charge % belongs to a different client', new.boarding_charge_id; end if;
  end if;

  if new.client_charge_id is not null then
    select stable_id, client_id into cc_stable, cc_client
      from client_charges where id = new.client_charge_id;
    if cc_stable is null or cc_stable <> new.stable_id then
      raise exception 'client charge % does not belong to stable %', new.client_charge_id, new.stable_id; end if;
    if cc_client <> new.client_id then
      raise exception 'client charge % belongs to a different client', new.client_charge_id; end if;
  end if;

  return new;
end $$;

-- ---------------- RLS ----------------
alter table client_charges enable row level security;
alter table client_charges force  row level security;

create policy client_charges_read_staff on client_charges
  for select
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'));

create policy client_charges_read_self on client_charges
  for select
  using (stable_id = current_stable_id()
         and client_id = current_client_id());

create policy client_charges_write_owner on client_charges
  for all
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner')
  with check (stable_id = current_stable_id());

-- ---------------- SUMMARY VIEW ----------------
-- Per-charge with paid amount and computed status. Same shape as
-- horse_boarding_summary, kept in sync so UI can reuse render logic.
create or replace view client_charge_summary
with (security_invoker = true) as
select
  c.id,
  c.stable_id,
  c.client_id,
  c.horse_id,
  c.kind,
  c.custom_label,
  c.amount,
  c.incurred_on,
  c.notes,
  c.created_at,
  c.updated_at,
  coalesce((
    select sum(amount) from payments where client_charge_id = c.id
  ), 0)::numeric(10,2) as paid_amount,
  case
    when coalesce((select sum(amount) from payments where client_charge_id = c.id), 0) >= c.amount
      then 'paid'
    when coalesce((select sum(amount) from payments where client_charge_id = c.id), 0) > 0
      then 'partial'
    else 'unpaid'
  end as payment_status
from client_charges c;

grant select on client_charge_summary to authenticated;

-- ---------------- BALANCE RPC EXTENSION ----------------
-- Fold these charges into the existing balance number so client portal
-- and "owes/credit" pills stay correct without UI changes elsewhere.
create or replace function client_balance(p_client_id uuid)
returns numeric language sql stable as $$
  with charges as (
    select coalesce(sum(price), 0) as total
    from lessons
    where client_id = p_client_id
      and status in ('scheduled', 'completed')
  ),
  misc as (
    select coalesce(sum(amount), 0) as total
    from client_charges
    where client_id = p_client_id
  ),
  paid as (
    select coalesce(sum(amount), 0) as total
    from payments
    where client_id = p_client_id
  )
  select (paid.total - charges.total - misc.total)::numeric
  from charges, misc, paid;
$$;

-- =============================================================
-- DONE. Run this in the Supabase SQL Editor (or supabase db push).
-- =============================================================
