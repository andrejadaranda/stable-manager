-- =============================================================
-- 03_helpers.sql
-- RLS context helpers. SECURITY DEFINER + STABLE so they run as
-- table owner (bypassing recursive RLS on `profiles`) and are
-- cached per-statement by the planner.
--
-- These four functions are the only place that reads the JWT
-- (auth.uid()). Every policy in 04_policies.sql is built on top.
-- =============================================================

-- The stable the calling auth user belongs to (NULL if none).
create or replace function current_stable_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select stable_id from profiles where auth_user_id = auth.uid() limit 1;
$$;

-- The role of the calling auth user within their stable.
create or replace function current_user_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where auth_user_id = auth.uid() limit 1;
$$;

-- The internal profiles.id of the calling auth user.
create or replace function current_user_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from profiles where auth_user_id = auth.uid() limit 1;
$$;

-- The clients.id linked to the calling auth user (NULL for staff or
-- clients without a portal link).
create or replace function current_client_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select c.id
  from clients c
  join profiles p on p.id = c.profile_id
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

-- Lock these down: only authenticated callers should reach them.
revoke all on function current_stable_id() from public;
revoke all on function current_user_role() from public;
revoke all on function current_user_id()   from public;
revoke all on function current_client_id() from public;

grant execute on function current_stable_id() to authenticated;
grant execute on function current_user_role() to authenticated;
grant execute on function current_user_id()   to authenticated;
grant execute on function current_client_id() to authenticated;
