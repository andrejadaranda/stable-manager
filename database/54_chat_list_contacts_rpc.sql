-- =============================================================
-- 54_chat_list_contacts_rpc.sql
-- BUG #Z: open chat picker did not return any contacts for owners
-- because the service-layer filter (`allowedTargetRoles`) still
-- whitelisted only ["employee"] for owner, even after migration 50
-- made the SQL chat_can_dm() any-to-any.
--
-- Clients additionally couldn't see other profiles at all because
-- of profiles_read_self RLS (clients only read their own row).
--
-- This SECURITY DEFINER RPC returns every other member of the
-- caller's stable, honoring the same any-to-any rule chat_can_dm
-- enforces server-side. Service layer calls this instead of
-- query-building against profiles directly.
--
-- Already applied via Supabase MCP. This file is the canonical
-- source-of-truth copy.
-- =============================================================

create or replace function list_chat_contacts()
  returns table (profile_id uuid, full_name text, role user_role)
  language plpgsql stable security definer set search_path = public as $$
declare
  v_caller_id   uuid      := current_user_id();
  v_caller_stbl uuid      := current_stable_id();
begin
  if v_caller_id is null or v_caller_stbl is null then
    return;
  end if;

  return query
    select p.id, p.full_name, p.role
      from profiles p
     where p.stable_id = v_caller_stbl
       and p.id <> v_caller_id
       and p.role is not null
     order by
       case p.role
         when 'owner'    then 1
         when 'employee' then 2
         when 'client'   then 3
         else 4
       end,
       coalesce(p.full_name, '') asc;
end $$;

revoke all    on function list_chat_contacts() from public;
grant execute on function list_chat_contacts() to authenticated;
