-- =============================================================
-- 81_chat_participant_names_definer.sql
-- Clients can't read staff profile rows (profiles_read_self RLS), so the
-- chat thread/message profile joins returned NULL names for the other
-- party — direct threads showed "?" + a generic "Direct message" label,
-- and staff replies rendered as "Member". This SECURITY DEFINER function
-- returns participant names ONLY for threads the caller participates in,
-- so names resolve without weakening profiles RLS.
-- =============================================================
create or replace function get_my_chat_participants(p_thread_ids uuid[])
returns table(thread_id uuid, profile_id uuid, full_name text, role user_role)
language sql
stable
security definer
set search_path = public
as $$
  select cp.thread_id, cp.profile_id, pr.full_name, pr.role
  from chat_participants cp
  join profiles pr on pr.id = cp.profile_id
  where cp.thread_id = any(p_thread_ids)
    and exists (
      select 1 from chat_participants me
      where me.thread_id = cp.thread_id
        and me.profile_id = auth.uid()
    );
$$;

grant execute on function get_my_chat_participants(uuid[]) to authenticated;
