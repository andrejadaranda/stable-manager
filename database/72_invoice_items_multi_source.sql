-- =============================================================
-- 72_invoice_items_multi_source.sql
-- Invoice line items can now come from boarding charges, misc client
-- charges, and farrier/vet per-horse costs — not just lessons. These
-- nullable source columns let generation dedupe (never invoice the same
-- charge twice). Applied via Supabase MCP; this is the canonical copy.
-- =============================================================

alter table invoice_items
  add column if not exists boarding_charge_id uuid,
  add column if not exists client_charge_id   uuid,
  add column if not exists farrier_visit_id    uuid,
  add column if not exists farrier_horse_id    uuid;

create index if not exists invoice_items_boarding_idx
  on invoice_items (boarding_charge_id) where boarding_charge_id is not null;
create index if not exists invoice_items_clientcharge_idx
  on invoice_items (client_charge_id) where client_charge_id is not null;
create index if not exists invoice_items_farrier_idx
  on invoice_items (farrier_visit_id, farrier_horse_id) where farrier_visit_id is not null;
