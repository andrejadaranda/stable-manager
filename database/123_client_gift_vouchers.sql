-- =============================================================
-- 123_client_gift_vouchers.sql
--
-- Gift-voucher register. Vouchers are sold (often by a parent/buyer) and
-- assigned to the recipient client. This is a TRACKING-ONLY record — it does
-- NOT touch the account balance, credit pool, or revenue. The owner reads
-- "who holds which voucher, for how much, for what, valid until when, and
-- whether it's been used" straight off the client profile. Redemption is
-- handled by the owner the normal way (booking the covered lessons); marking a
-- voucher used here is just a status flag for the register.
--
-- Source of truth for the first import: the TJK "Dovanų kuponų apskaita"
-- Google Sheet. Columns map 1:1 (Data, Kupono nr., Vardas/Pavardė, El. paštas,
-- Telefonas, Paslauga, Suma, Mokėjimo būdas, Užsakymo nr., Galioja iki,
-- Apmokėta).
--
-- Applied to live DB dluxzjphpokzkrwmmibe. Idempotent.
-- =============================================================

create table if not exists client_gift_vouchers (
  id             uuid primary key default gen_random_uuid(),
  stable_id      uuid not null references stables(id) on delete cascade,
  client_id      uuid not null references clients(id) on delete restrict,
  code           text not null,
  issued_on      date not null default current_date,  -- "Data"
  service_label  text,                                -- "Paslauga"
  amount         numeric(10,2) not null check (amount >= 0), -- "Suma (EUR)"
  payment_method text,                                -- "Mokėjimo būdas" (may name the buyer)
  valid_until    date,                                -- "Galioja iki"
  paid_on        date,                                -- "Apmokėta"
  order_no       text,                                -- "Užsakymo nr."
  buyer_email    text,                                -- "El. paštas" (often the BUYER, not the recipient)
  buyer_phone    text,                                -- "Telefonas"
  redeemed       boolean not null default false,      -- used-up flag for the register
  notes          text,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One voucher code per stable (codes are unique in the TJK register).
create unique index if not exists cgv_stable_code_uidx
  on client_gift_vouchers (stable_id, code);

create index if not exists cgv_client_idx
  on client_gift_vouchers (stable_id, client_id, issued_on desc);

-- Same-stable integrity: the client must belong to the row's stable.
create or replace function client_gift_vouchers_enforce_same_stable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from clients c where c.id = new.client_id and c.stable_id = new.stable_id) then
    raise exception 'client_gift_vouchers: client % is not in stable %', new.client_id, new.stable_id;
  end if;
  return new;
end $$;

drop trigger if exists cgv_same_stable on client_gift_vouchers;
create trigger cgv_same_stable before insert or update on client_gift_vouchers
  for each row execute function client_gift_vouchers_enforce_same_stable();

drop trigger if exists cgv_set_updated on client_gift_vouchers;
create trigger cgv_set_updated before update on client_gift_vouchers
  for each row execute function set_updated_at();

alter table client_gift_vouchers enable row level security;
alter table client_gift_vouchers force  row level security;

drop policy if exists cgv_read_staff on client_gift_vouchers;
create policy cgv_read_staff on client_gift_vouchers for select
  using (stable_id = current_stable_id() and current_user_role() in ('owner','employee'));

drop policy if exists cgv_read_self on client_gift_vouchers;
create policy cgv_read_self on client_gift_vouchers for select
  using (stable_id = current_stable_id() and client_id = current_client_id());

drop policy if exists cgv_write_owner on client_gift_vouchers;
create policy cgv_write_owner on client_gift_vouchers for all
  using (stable_id = current_stable_id() and current_user_role() = 'owner')
  with check (stable_id = current_stable_id() and current_user_role() = 'owner');
