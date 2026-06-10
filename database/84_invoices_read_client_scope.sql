-- =============================================================
-- 84_invoices_read_client_scope.sql
-- PRIVACY + FEATURE: invoices_read was stable-wide with no role check, so a
-- client could read every other client's invoices via the API. Scope it:
-- staff (owner/employee) see all invoices in the stable; a client sees only
-- their own. invoice_items_read cascades through the invoices subquery, so
-- it inherits this scoping automatically. Also enables the client portal
-- "My invoices" page.
-- =============================================================
drop policy if exists invoices_read on invoices;
create policy invoices_read on invoices
  for select
  using (
    stable_id = current_stable_id()
    and (
      current_user_role() in ('owner', 'employee')
      or client_id = current_client_id()
    )
  );
