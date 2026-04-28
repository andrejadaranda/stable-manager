-- =============================================================
-- 13_sessions_policies.sql
-- RLS for sessions. Same pattern as 04_policies.sql:
--   - everything keyed off current_stable_id() + current_user_role()
--   - clients see only their own activity
-- =============================================================

alter table sessions enable row level security;

-- ---------------- READ ----------------

-- Staff (owner + employee) read every session in their stable.
create policy sessions_read_staff on sessions
  for select
  using (
    stable_id = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  );

-- Clients read sessions where they were the rider.
-- Note: current_client_id() is null for clients without a portal link, so
-- this policy correctly returns no rows for unlinked clients.
create policy sessions_read_own_client on sessions
  for select
  using (
    stable_id = current_stable_id()
    and current_user_role() = 'client'
    and rider_client_id is not null
    and rider_client_id = current_client_id()
  );

-- ---------------- WRITE ----------------

-- Staff can insert/update/delete sessions in their stable.
-- with check on stable_id pins inserts to the caller's tenant.
create policy sessions_write_staff on sessions
  for all
  using (
    stable_id = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  )
  with check (
    stable_id = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  );

-- =============================================================
-- The view v_horse_activity_7d inherits RLS from `horses` and
-- `sessions` because it was created with security_invoker = on.
-- Staff see all active horses; clients see none (horses_read_staff
-- already restricts that). No extra policy needed on the view.
-- =============================================================
