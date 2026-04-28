-- =============================================================
-- 11_chat_functions.sql
-- Chat permission helper + RPCs:
--   chat_can_dm(target_profile_id) -> bool
--   start_direct_thread(target_profile_id) -> uuid
--   mark_thread_read(thread_id) -> void
--
-- All three are SECURITY DEFINER so they can write to tables
-- whose policies do not expose INSERT (chat_threads,
-- chat_participants). Each function reads only
-- current_stable_id() / current_user_id() / current_user_role();
-- they never trust client-supplied stable IDs.
-- =============================================================

-- -------------------------------------------------------------
-- chat_can_dm
--
-- Allowed (caller_role, target_role) pairs:
--   (owner,    employee)   ✅
--   (employee, owner)      ✅
--   (employee, client)     ✅
--   (client,   employee)   ✅
-- Everything else → false.
--
-- Also enforces:
--   - target exists in same stable
--   - target is not the caller
-- -------------------------------------------------------------
create or replace function chat_can_dm(p_target_profile_id uuid)
  returns boolean
  language plpgsql stable security definer set search_path = public as $$
declare
  v_caller_role  user_role := current_user_role();
  v_caller_id    uuid      := current_user_id();
  v_caller_stbl  uuid      := current_stable_id();
  v_target_role  user_role;
  v_target_stbl  uuid;
begin
  if v_caller_role is null or v_caller_id is null or v_caller_stbl is null then
    return false;
  end if;
  if p_target_profile_id is null or p_target_profile_id = v_caller_id then
    return false;
  end if;

  select role, stable_id into v_target_role, v_target_stbl
    from profiles where id = p_target_profile_id;

  if v_target_stbl is null or v_target_stbl <> v_caller_stbl then
    return false;
  end if;

  return (v_caller_role = 'owner'    and v_target_role = 'employee')
      or (v_caller_role = 'employee' and v_target_role = 'owner')
      or (v_caller_role = 'employee' and v_target_role = 'client')
      or (v_caller_role = 'client'   and v_target_role = 'employee');
end $$;

revoke all    on function chat_can_dm(uuid) from public;
grant execute on function chat_can_dm(uuid) to authenticated;

-- -------------------------------------------------------------
-- start_direct_thread
--
-- Creates (or returns existing) a direct thread between the
-- caller and p_target_profile_id. Two participant rows are
-- inserted in the same transaction.
--
-- Errors:
--   CHAT_FORBIDDEN      — pair not allowed by chat_can_dm
--   CHAT_UNAUTHENTICATED — no session
-- -------------------------------------------------------------
create or replace function start_direct_thread(p_target_profile_id uuid)
  returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_caller_id    uuid      := current_user_id();
  v_caller_role  user_role := current_user_role();
  v_stable_id    uuid      := current_stable_id();
  v_target_role  user_role;
  v_thread_id    uuid;
begin
  if v_caller_id is null or v_stable_id is null then
    raise exception 'CHAT_UNAUTHENTICATED';
  end if;

  if not chat_can_dm(p_target_profile_id) then
    raise exception 'CHAT_FORBIDDEN';
  end if;

  select role into v_target_role from profiles
    where id = p_target_profile_id and stable_id = v_stable_id;

  -- Find existing direct thread between exactly the two of them.
  select t.id into v_thread_id
    from chat_threads t
   where t.stable_id = v_stable_id
     and t.type = 'direct'
     and (
       select count(*) from chat_participants p where p.thread_id = t.id
     ) = 2
     and exists (
       select 1 from chat_participants p
        where p.thread_id = t.id and p.profile_id = v_caller_id
     )
     and exists (
       select 1 from chat_participants p
        where p.thread_id = t.id and p.profile_id = p_target_profile_id
     )
   limit 1;

  if v_thread_id is not null then
    return v_thread_id;
  end if;

  insert into chat_threads(stable_id, type, created_by)
    values (v_stable_id, 'direct', v_caller_id)
    returning id into v_thread_id;

  insert into chat_participants(stable_id, thread_id, profile_id, role_at_join)
  values
    (v_stable_id, v_thread_id, v_caller_id,        v_caller_role),
    (v_stable_id, v_thread_id, p_target_profile_id, v_target_role);

  return v_thread_id;
end $$;

revoke all    on function start_direct_thread(uuid) from public;
grant execute on function start_direct_thread(uuid) to authenticated;

-- -------------------------------------------------------------
-- mark_thread_read
--
-- Upserts a chat_participants row for the caller on the thread,
-- setting last_read_at = now(). Works for both general and
-- direct threads. Validates that the thread is visible to the
-- caller before writing.
-- -------------------------------------------------------------
create or replace function mark_thread_read(p_thread_id uuid)
  returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_caller_id    uuid      := current_user_id();
  v_caller_role  user_role := current_user_role();
  v_stable_id    uuid      := current_stable_id();
  v_thread_stbl  uuid;
begin
  if v_caller_id is null or v_stable_id is null then
    raise exception 'CHAT_UNAUTHENTICATED';
  end if;

  -- Verify the thread is visible to this caller.
  if not exists (
    select 1 from chat_visible_thread_ids() v where v = p_thread_id
  ) then
    raise exception 'CHAT_FORBIDDEN';
  end if;

  -- Same-stable sanity (defense-in-depth; should be guaranteed by
  -- the visibility helper).
  select stable_id into v_thread_stbl from chat_threads where id = p_thread_id;
  if v_thread_stbl is null or v_thread_stbl <> v_stable_id then
    raise exception 'CHAT_FORBIDDEN';
  end if;

  insert into chat_participants(stable_id, thread_id, profile_id, role_at_join, last_read_at)
    values (v_stable_id, p_thread_id, v_caller_id, v_caller_role, now())
  on conflict (thread_id, profile_id)
    do update set last_read_at = excluded.last_read_at;
end $$;

revoke all    on function mark_thread_read(uuid) from public;
grant execute on function mark_thread_read(uuid) to authenticated;
