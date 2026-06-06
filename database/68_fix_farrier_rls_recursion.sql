-- =============================================================
-- 68_fix_farrier_rls_recursion.sql
-- Fix 42P17 "infinite recursion detected in policy" on farrier_visits.
--
-- Cause: farrier_visits_read_owner_client (66) EXISTS-checked
-- farrier_visit_horses, whose own policies EXISTS-checked farrier_visits
-- back — a policy evaluation cycle Postgres rejects at query time. The
-- app swallowed it (.catch -> []) so the calendar silently showed no
-- visits.
--
-- Fix: SECURITY DEFINER helpers bypass RLS inside the cross-table
-- checks (same style as current_* helpers in 03_helpers.sql), making
-- the dependency one-directional. Applied via Supabase MCP; this file
-- is the canonical copy.
-- =============================================================

create or replace function client_owns_horse_in_visit(p_visit_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from farrier_visit_horses fvh
    join horses h on h.id = fvh.horse_id
    where fvh.visit_id = p_visit_id
      and h.owner_client_id = current_client_id()
  );
$$;

create or replace function care_visit_stable_id(p_visit_id uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select stable_id from farrier_visits where id = p_visit_id;
$$;

-- farrier_visits: replace the recursive owner-client read policy.
drop policy if exists farrier_visits_read_owner_client on farrier_visits;
create policy farrier_visits_read_owner_client on farrier_visits
  for select
  using (
    stable_id = current_stable_id()
    and current_user_role() = 'client'
    and current_client_id() is not null
    and client_owns_horse_in_visit(farrier_visits.id)
  );

-- farrier_visit_horses: replace policies that referenced farrier_visits.
drop policy if exists fvh_read_staff on farrier_visit_horses;
create policy fvh_read_staff on farrier_visit_horses
  for select
  using (
    current_user_role() in ('owner', 'employee')
    and care_visit_stable_id(farrier_visit_horses.visit_id) = current_stable_id()
  );

drop policy if exists fvh_write_staff on farrier_visit_horses;
create policy fvh_write_staff on farrier_visit_horses
  for all
  using (
    current_user_role() in ('owner', 'employee')
    and care_visit_stable_id(farrier_visit_horses.visit_id) = current_stable_id()
  )
  with check (
    current_user_role() in ('owner', 'employee')
    and care_visit_stable_id(farrier_visit_horses.visit_id) = current_stable_id()
  );

-- fvh_read_owner_client (66) references only horses — no cycle, kept as is.
