-- =============================================================
-- 70_farrier_horse_paid.sql
-- Per-horse paid flag for farrier/vet work. paid_at null = unpaid.
-- Markable from the visit AND the horse dashboard. Owners read it;
-- staff toggle it via set_farrier_horse_paid() (SECURITY DEFINER so it
-- flips one junction row without tripping the policy cycle).
-- Applied via Supabase MCP; this file is the canonical copy.
-- =============================================================

alter table farrier_visit_horses
  add column if not exists paid_at timestamptz;

create or replace function set_farrier_horse_paid(
  p_visit_id uuid, p_horse_id uuid, p_paid boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare s_id uuid; r user_role;
begin
  select stable_id into s_id from farrier_visits where id = p_visit_id;
  if s_id is null then raise exception 'visit not found'; end if;
  if s_id <> current_stable_id() then raise exception 'forbidden'; end if;
  r := current_user_role();
  if r not in ('owner','employee') then raise exception 'forbidden'; end if;
  update farrier_visit_horses
     set paid_at = case when p_paid then now() else null end
   where visit_id = p_visit_id and horse_id = p_horse_id;
end;
$$;
