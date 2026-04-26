-- =============================================================
-- 04_policies.sql
-- Row Level Security: enable + force on every tenant table, then
-- declare policies. The audit's role-escalation hole (clients
-- updating their own role) is gone: only owners can write profiles.
--
-- Visibility model:
--   stables   : member read; owner update
--   profiles  : staff read all in stable; client read self only;
--               WRITE: owner only (NO self-update -> no role escalation)
--   horses    : staff read+write
--   clients   : staff read+write; client read own row
--   lessons   : staff read+write; client read own
--   payments  : OWNER read+write; client read own
--   expenses  : OWNER read+write
-- =============================================================

-- ---------------- ENABLE + FORCE ----------------
alter table stables  enable row level security;
alter table profiles enable row level security;
alter table horses   enable row level security;
alter table clients  enable row level security;
alter table lessons  enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;

alter table stables  force row level security;
alter table profiles force row level security;
alter table horses   force row level security;
alter table clients  force row level security;
alter table lessons  force row level security;
alter table payments force row level security;
alter table expenses force row level security;

-- ============================================================
-- STABLES
-- ============================================================
create policy stables_read_member on stables
  for select
  using (id = current_stable_id());

create policy stables_update_owner on stables
  for update
  using (id = current_stable_id() and current_user_role() = 'owner')
  with check (id = current_stable_id());

-- ============================================================
-- PROFILES
-- Staff read all in stable; clients read only their own row.
-- WRITE: owner only. No self-update policy, by design — this
-- prevents the role-escalation hole from the audit.
-- ============================================================
create policy profiles_read_staff on profiles
  for select
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'));

create policy profiles_read_self on profiles
  for select
  using (stable_id = current_stable_id()
         and auth_user_id = auth.uid());

create policy profiles_owner_all on profiles
  for all
  using (stable_id = current_stable_id() and current_user_role() = 'owner')
  with check (stable_id = current_stable_id());

-- ============================================================
-- HORSES (staff read + write; clients have no direct access)
-- ============================================================
create policy horses_read_staff on horses
  for select
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'));

create policy horses_write_staff on horses
  for all
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'))
  with check (stable_id = current_stable_id());

-- ============================================================
-- CLIENTS
-- Staff read+write; client reads only own row.
-- ============================================================
create policy clients_read_staff on clients
  for select
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'));

create policy clients_read_self on clients
  for select
  using (stable_id = current_stable_id()
         and id = current_client_id());

create policy clients_write_staff on clients
  for all
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'))
  with check (stable_id = current_stable_id());

-- ============================================================
-- LESSONS (operational calendar)
-- Staff read+write; client reads only own lessons.
-- ============================================================
create policy lessons_read_staff on lessons
  for select
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'));

create policy lessons_read_client on lessons
  for select
  using (stable_id = current_stable_id()
         and client_id = current_client_id());

create policy lessons_write_staff on lessons
  for all
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'))
  with check (stable_id = current_stable_id());

-- ============================================================
-- PAYMENTS
-- OWNER only for read+write. Clients can read their own payments
-- (so the portal balance/history works). Employees: NO access.
-- ============================================================
create policy payments_read_owner on payments
  for select
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner');

create policy payments_read_self on payments
  for select
  using (stable_id = current_stable_id()
         and client_id = current_client_id());

create policy payments_write_owner on payments
  for all
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner')
  with check (stable_id = current_stable_id());

-- ============================================================
-- EXPENSES (owner-only. Employees have no read or write.)
-- ============================================================
create policy expenses_read_owner on expenses
  for select
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner');

create policy expenses_write_owner on expenses
  for all
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner')
  with check (stable_id = current_stable_id());
