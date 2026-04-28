-- =============================================================
-- 21_horse_boarding.sql
--
-- Horse boarding fees (livery). Owners commonly bill per-month for
-- keeping a horse — feed, stall, hay, basic care. The horse already
-- has an `owner_client_id` (from 15_horse_owner.sql) which tells us
-- who's responsible for boarding payments.
--
-- Data model:
--   * horses.monthly_boarding_fee — optional default amount used to
--     pre-fill new charges. NULL means the stable owns the horse, or
--     boarding isn't billed for this horse.
--   * horse_boarding_charges — one row per billing period (typically a
--     month). Owner creates them manually or in bulk; payments settle
--     them via `payments.boarding_charge_id`.
--   * payments.boarding_charge_id — when present, the payment is
--     attached to a specific boarding charge. Same FIFO/aggregation
--     pattern as payments.lesson_id and payments.package_id.
--
-- RLS:
--   * read   : staff (owner + employee) for the whole stable;
--              client reads charges for horses they own.
--   * write  : OWNER only.
--
-- Pure additive: no data migration; existing horses untouched.
-- =============================================================

-- ---------------- TABLE ----------------
create table horse_boarding_charges (
  id                 uuid primary key default gen_random_uuid(),
  stable_id          uuid not null references stables(id) on delete cascade,
  horse_id           uuid not null references horses(id)  on delete restrict,
  -- Denormalised for clean RLS + filtering: the owner at the time the
  -- charge was created. Editing horses.owner_client_id later doesn't
  -- retroactively re-bill an old charge against a new owner.
  owner_client_id    uuid not null references clients(id) on delete restrict,
  period_start       date not null,
  period_end         date not null,
  -- Free-text label (e.g. "April 2026", "Spring '26"). Optional; when
  -- empty the UI derives one from period_start/period_end.
  period_label       text,
  amount             numeric(10,2) not null check (amount >= 0),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (period_end >= period_start)
);
create index on horse_boarding_charges(stable_id, horse_id, period_start desc);
create index on horse_boarding_charges(stable_id, owner_client_id, period_start desc);

-- ---------------- COLUMNS ON EXISTING TABLES ----------------
alter table horses
  add column monthly_boarding_fee numeric(10,2) check (monthly_boarding_fee is null or monthly_boarding_fee >= 0);

alter table payments
  add column boarding_charge_id uuid references horse_boarding_charges(id) on delete set null;
create index on payments(boarding_charge_id) where boarding_charge_id is not null;

-- ---------------- updated_at TRIGGER ----------------
create trigger trg_horse_boarding_charges_updated
  before update on horse_boarding_charges
  for each row execute function set_updated_at();

-- ---------------- SAME-STABLE ENFORCEMENT ----------------
-- Charge: horse + owner client must belong to same stable as the
-- charge row.
create or replace function horse_boarding_charges_enforce_same_stable() returns trigger
language plpgsql as $$
declare h_stable uuid; c_stable uuid;
begin
  select stable_id into h_stable from horses  where id = new.horse_id;
  select stable_id into c_stable from clients where id = new.owner_client_id;
  if h_stable is null or h_stable <> new.stable_id then
    raise exception 'horse % does not belong to stable %', new.horse_id, new.stable_id;
  end if;
  if c_stable is null or c_stable <> new.stable_id then
    raise exception 'client % does not belong to stable %', new.owner_client_id, new.stable_id;
  end if;
  return new;
end $$;

create trigger horse_boarding_charges_same_stable
  before insert or update on horse_boarding_charges
  for each row execute function horse_boarding_charges_enforce_same_stable();

-- Extend payments trigger to validate boarding_charge_id (same stable +
-- same client as the payment row).
create or replace function payments_enforce_same_stable() returns trigger
language plpgsql as $$
declare c_stable uuid; l_stable uuid; l_client uuid;
        p_stable uuid; p_client uuid;
        b_stable uuid; b_client uuid;
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

  return new;
end $$;

-- ---------------- RLS ----------------
alter table horse_boarding_charges enable row level security;
alter table horse_boarding_charges force  row level security;

-- Staff read all in stable.
create policy boarding_read_staff on horse_boarding_charges
  for select
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'));

-- Client reads charges where they're the owner.
create policy boarding_read_self on horse_boarding_charges
  for select
  using (stable_id = current_stable_id()
         and owner_client_id = current_client_id());

-- WRITE: OWNER only.
create policy boarding_write_owner on horse_boarding_charges
  for all
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner')
  with check (stable_id = current_stable_id());

-- ---------------- SUMMARY VIEW ----------------
-- One row per charge with the paid amount aggregated. security_invoker
-- so RLS still applies through both tables.
create or replace view horse_boarding_summary
with (security_invoker = true) as
select
  c.id,
  c.stable_id,
  c.horse_id,
  c.owner_client_id,
  c.period_start,
  c.period_end,
  c.period_label,
  c.amount,
  c.notes,
  c.created_at,
  c.updated_at,
  coalesce((
    select sum(amount) from payments where boarding_charge_id = c.id
  ), 0)::numeric(10,2) as paid_amount,
  case
    when coalesce((select sum(amount) from payments where boarding_charge_id = c.id), 0) >= c.amount and c.amount > 0
      then 'paid'
    when coalesce((select sum(amount) from payments where boarding_charge_id = c.id), 0) > 0
      then 'partial'
    else 'unpaid'
  end as payment_status
from horse_boarding_charges c;

grant select on horse_boarding_summary to authenticated;

-- =============================================================
-- DONE. Run this script in the Supabase SQL Editor (or
-- supabase db push) to apply.
-- =============================================================
