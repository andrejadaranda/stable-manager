-- 102_payments_invoice_id.sql
-- Marking an invoice "paid" must move real money: client_account_summary =
-- payments − charges, and an invoice on its own is NOT a charge, so flipping
-- only the status left revenue + balance untouched. We now record one payment
-- per invoice line item (linked to its source lesson/boarding/misc charge so
-- finance buckets correctly and a charge already settled directly isn't
-- double-paid). This column links those auto-payments back to the invoice so
-- the set is idempotent and reversible when an invoice leaves "paid".
-- Applied to live DB dluxzjphpokzkrwmmibe 2026-07-10.

alter table payments add column if not exists invoice_id uuid references invoices(id) on delete set null;
create index if not exists payments_invoice_id_idx on payments(invoice_id);

comment on column payments.invoice_id is
  'Set when this payment was auto-created by marking an invoice paid. Lets us dedupe and reverse the invoice payment set cleanly.';
