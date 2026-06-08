-- =============================================================
-- 73_farrier_horse_links_client_charge.sql
-- Unify farrier/vet per-horse cost with the existing client-charge ledger.
-- Each costed horse on a visit links to a client_charges row (kind
-- farrier / vet_copay) — the single source of truth for what the owner
-- owes. That charge shows in "Other charges", Outstanding, and invoices,
-- and "mark paid" creates a real payment (moving Collected/dashboard).
-- Applied via Supabase MCP; this is the canonical copy.
-- =============================================================

alter table farrier_visit_horses
  add column if not exists client_charge_id uuid references client_charges(id) on delete set null;

create index if not exists farrier_visit_horses_charge_idx
  on farrier_visit_horses (client_charge_id) where client_charge_id is not null;
