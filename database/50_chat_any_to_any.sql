-- =============================================================
-- 50_chat_any_to_any.sql
-- BUG #W: open chat to any member-pair within the same stable.
--
-- Already applied via Supabase MCP. This file is the canonical
-- source-of-truth copy.
--
-- Previous policy treated chat as hub-and-spoke (clients always
-- through trainer). User-reported friction: "kodel bet kas su bet
-- kuo is stable negali chatint". Stable is a trust group; restricting
-- DM pairs adds bureaucracy without security gain.
--
-- New rule: any two members of the same stable can DM each other.
-- Future hook: stable_features toggle for "restrict client↔client"
-- (e.g. safeguarding for minors). Not implemented — wait for signal.
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

  if v_target_role is null then
    return false;
  end if;

  return true;
end $$;

revoke all    on function chat_can_dm(uuid) from public;
grant execute on function chat_can_dm(uuid) to authenticated;
