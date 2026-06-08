-- =============================================================
-- 71_farrier_visit_expense_link.sql
-- Link a farrier/vet visit to a stable expense.
--   expense_cents — what the stable paid the farrier/vet for the whole
--                   visit (an outflow), distinct from per-horse cost_cents
--                   (what owners owe the stable).
--   expense_id    — the `expenses` row the service created, so editing the
--                   visit updates the same expense instead of duplicating.
-- Applied via Supabase MCP; this file is the canonical copy.
-- =============================================================

alter table farrier_visits
  add column if not exists expense_cents int,
  add column if not exists expense_id uuid references expenses(id) on delete set null;
