-- =============================================================
-- 06_auth.sql
-- Two SECURITY DEFINER RPCs that bridge Supabase Auth to the
-- multi-tenant model:
--
--   provision_stable        -> first-time signup creates a stable
--                              and assigns the caller as 'owner'.
--   attach_user_to_stable   -> owner adds an already-invited
--                              auth user as employee or client.
--                              Hardened: NEVER moves users between
--                              stables. Rejects on any prior membership.
-- =============================================================

-- -------------------------------------------------------------
-- provision_stable: bootstrap a new tenant.
-- The caller must be authenticated and not already a member.
-- -------------------------------------------------------------
create or replace function provision_stable(
  p_stable_name text,
  p_stable_slug text,
  p_full_name   text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_stable_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from profiles where auth_user_id = auth.uid()) then
    raise exception 'user already belongs to a stable';
  end if;

  insert into stables(name, slug)
    values (p_stable_name, p_stable_slug)
    returning id into v_stable_id;

  insert into profiles(auth_user_id, stable_id, full_name, role)
    values (auth.uid(), v_stable_id, p_full_name, 'owner');

  return v_stable_id;
end $$;

revoke all on function provision_stable(text, text, text) from public;
grant execute on function provision_stable(text, text, text) to authenticated;

-- -------------------------------------------------------------
-- attach_user_to_stable: owner adds an invited user.
-- Safety guarantees:
--   * caller MUST be 'owner' of a stable
--   * target auth user MUST exist
--   * target auth user MUST NOT already be a member of any stable
--     (hard reject — no upsert, no cross-stable move)
--   * cannot create another 'owner' through this RPC (only
--     'employee' or 'client' allowed).
--
-- Typical flow:
--   1. server action invokes supabase.auth.admin.inviteUserByEmail
--   2. once invitation creates an auth.users row, server calls this
-- -------------------------------------------------------------
create or replace function attach_user_to_stable(
  p_auth_user_id uuid,
  p_full_name    text,
  p_role         user_role
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller_role user_role;
  v_stable_id   uuid;
  v_profile_id  uuid;
begin
  v_caller_role := current_user_role();
  v_stable_id   := current_stable_id();

  if v_caller_role is null or v_caller_role <> 'owner' then
    raise exception 'only owners can attach users';
  end if;

  if v_stable_id is null then
    raise exception 'caller has no stable';
  end if;

  if p_role not in ('employee', 'client') then
    raise exception 'invalid role for attach: %', p_role;
  end if;

  if not exists (select 1 from auth.users where id = p_auth_user_id) then
    raise exception 'auth user does not exist';
  end if;

  -- Hard reject: never move a user between stables.
  if exists (select 1 from profiles where auth_user_id = p_auth_user_id) then
    raise exception 'auth user already belongs to a stable';
  end if;

  insert into profiles(auth_user_id, stable_id, full_name, role)
    values (p_auth_user_id, v_stable_id, p_full_name, p_role)
    returning id into v_profile_id;

  return v_profile_id;
end $$;

revoke all on function attach_user_to_stable(uuid, text, user_role) from public;
grant execute on function attach_user_to_stable(uuid, text, user_role) to authenticated;
