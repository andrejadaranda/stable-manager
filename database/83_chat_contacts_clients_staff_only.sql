-- =============================================================
-- 83_chat_contacts_clients_staff_only.sql
-- PRIVACY FIX: list_chat_contacts() returned every profile in the stable
-- to any caller, so a CLIENT saw all other clients' names in the New-DM
-- picker. Scope it: clients may only start chats with staff (owner/
-- employee); staff may message anyone. No client ever sees a client list.
-- =============================================================
create or replace function list_chat_contacts()
returns table(profile_id uuid, full_name text, role user_role)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_caller_id   uuid      := current_user_id();
  v_caller_stbl uuid      := current_stable_id();
  v_caller_role user_role := current_user_role();
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
       and (
         v_caller_role in ('owner', 'employee')   -- staff see everyone
         or p.role in ('owner', 'employee')        -- clients see staff only
       )
     order by
       case p.role
         when 'owner'    then 1
         when 'employee' then 2
         when 'client'   then 3
         else 4
       end,
       coalesce(p.full_name, '') asc;
end $function$;
