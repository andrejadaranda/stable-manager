-- 107_invoice_kind_and_vat.sql
-- faktūra vs proforma + VAT-by-country foundation.
--   invoices.kind: 'invoice' (faktūra, fiscal) | 'proforma' (išankstinė, quote).
--   stables.country drives the default VAT rate; stables.vat_rate is applied.
-- billable_items rebuilt so the "invoiced" dedup flag only counts REAL invoices
-- (kind='invoice', not cancelled) — a proforma must not block an item from the
-- real faktūra. Applied to live DB dluxzjphpokzkrwmmibe 2026-07-20.

alter table invoices add column if not exists kind text not null default 'invoice';
alter table invoices drop constraint if exists invoices_kind_check;
alter table invoices add constraint invoices_kind_check check (kind in ('invoice','proforma'));

alter table stables add column if not exists country text;
alter table stables add column if not exists vat_rate numeric not null default 0;

-- billable_items rebuilt (see migration history for full DDL): the invoiced flag
-- now joins invoices and requires kind='invoice' and status <> 'cancelled'.
