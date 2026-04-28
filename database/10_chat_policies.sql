-- =============================================================
-- 10_chat_policies.sql
-- RLS for the chat module. enable + force on every chat table,
-- then policies built on a SECURITY DEFINER visibility helper.
--
-- Visibility model:
--   chat_threads
--     SELECT  : id in (chat_visible_thread_ids)
--     INSERT  : DENIED  (only via start_direct_thread RPC and the
--                        stables_create_general_chat trigger)
--     UPDATE  : owner only, only for the general thread (rename)
--     DELETE  : DENIED in MVP
--
--   chat_participants
--     SELECT  : thread_id in (chat_visible_thread_ids)
--     INSERT  : DENIED  (only via start_direct_thread / mark_thread_read RPCs)
--     UPDATE  : caller's own row (last_read_at)
--     DELETE  : DENIED
--
--   chat_messages
--     SELECT  : thread_id in (chat_visible_thread_ids), not soft-deleted
--     INSERT  : sender = self, thread visible, same stable, no edit/delete on insert
--     UPDATE  : DENIED in MVP (no edit)
--     DELETE  : DENIED in MVP (use future soft-delete RPC)
-- =============================================================

-- -------------------------------------------------------------
-- chat_visible_thread_ids()
-- Returns every thread id the calling user is allowed to see:
--   * the single 'stable_general' thread for the caller's stable
--   * every 'direct' thread where the caller has a chat_participants row
--
-- SECURITY DEFINER + STABLE so the function runs as table owner
-- (bypassing recursive RLS) and is cached per-statement. Reads
-- only current_stable_id() / current_user_id(); never trusts
-- client-supplied input.
-- -------------------------------------------------------------
create or replace function chat_visible_thread_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select id from chat_threads
   where stable_id = current_stable_id()
     and type = 'stable_general'
  union
  select cp.thread_id from chat_participants cp
   where cp.profile_id = current_user_id()
     and cp.stable_id  = current_stable_id();
$$;

revoke all    on function chat_visible_thread_ids() from public;
grant execute on function chat_visible_thread_ids() to authenticated;

-- -------------------------------------------------------------
-- ENABLE + FORCE RLS
-- -------------------------------------------------------------
alter table chat_threads      enable row level security;
alter table chat_participants enable row level security;
alter table chat_messages     enable row level security;

alter table chat_threads      force row level security;
alter table chat_participants force row level security;
alter table chat_messages     force row level security;

-- =============================================================
-- chat_threads
-- =============================================================

create policy chat_threads_read on chat_threads
  for select
  using (id in (select chat_visible_thread_ids()));

-- Owner can rename their stable's general thread. No other UPDATE.
create policy chat_threads_update_general_owner on chat_threads
  for update
  using (
    stable_id = current_stable_id()
    and type = 'stable_general'
    and current_user_role() = 'owner'
  )
  with check (
    stable_id = current_stable_id()
    and type = 'stable_general'
  );

-- No INSERT policy: only the SECURITY DEFINER paths
-- (stables_create_general_chat trigger, start_direct_thread RPC)
-- write here.
-- No DELETE policy: threads are not deletable in MVP.

-- =============================================================
-- chat_participants
-- =============================================================

create policy chat_participants_read on chat_participants
  for select
  using (thread_id in (select chat_visible_thread_ids()));

-- Caller can update only their own participant row. The intended
-- field is last_read_at; the RPC mark_thread_read enforces that.
-- Direct UPDATEs from the client are not used by the service layer.
create policy chat_participants_update_self on chat_participants
  for update
  using (
    profile_id = current_user_id()
    and stable_id = current_stable_id()
  )
  with check (
    profile_id = current_user_id()
    and stable_id = current_stable_id()
  );

-- No INSERT / DELETE policies. RPCs handle inserts via SECURITY
-- DEFINER. ON DELETE CASCADE from threads/profiles handles cleanup.

-- =============================================================
-- chat_messages
-- =============================================================

create policy chat_messages_read on chat_messages
  for select
  using (
    thread_id in (select chat_visible_thread_ids())
    and deleted_at is null
  );

create policy chat_messages_insert on chat_messages
  for insert
  with check (
    stable_id = current_stable_id()
    and sender_profile_id = current_user_id()
    and thread_id in (select chat_visible_thread_ids())
    and edited_at is null
    and deleted_at is null
  );

-- No UPDATE policy: edit deferred.
-- No DELETE policy: hard delete forbidden; future soft-delete RPC.
