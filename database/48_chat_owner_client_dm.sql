-- =============================================================
-- 48_chat_owner_client_dm.sql
-- BUG #V FIX: owner ↔ client DM was forbidden by chat_can_dm.
--
-- Original policy assumed every client interaction would go through
-- an employee. In small stables the owner IS the only trainer, so
-- "no contacts available" appears on chat for solo-trainer setups.
--
-- Extend the allowed pairs:
--   (owner, client) ✅ NEW
--   (client, owner) ✅ NEW
-- All other pairs unchanged.
-- =============================================================

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
      or (v_caller_role = 'client'   and v_target_role = 'employee')
      -- NEW: owner ↔ client direct DM (small-stable solo-trainer fix)
      or (v_caller_role = 'owner'    and v_target_role = 'client')
      or (v_caller_role = 'client'   and v_target_role = 'owner');
end $$;

revoke all    on function chat_can_dm(uuid) from public;
grant execute on function chat_can_dm(uuid) to authenticated;
