-- =============================================================
-- 98_audit_skip_on_teardown.sql  (applied via Supabase MCP 2026-07-08)
-- Whole-stable deletion (App Store 5.1.1 account deletion) deletes the stable
-- row first, then cascades to children. The record_audit_log() DELETE trigger
-- on those children tried to INSERT an audit row referencing the already-gone
-- stable_id -> audit_log_stable_id_fkey violation -> aborted the whole delete.
-- Fix: skip auditing a DELETE whose stable no longer exists (only happens
-- during teardown). Normal deletes (stable present) are audited exactly as before.
-- =============================================================
create or replace function public.record_audit_log()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_stable_id uuid;
  v_action    text;
  v_row_id    uuid;
  v_summary   text;
begin
  if TG_OP = 'INSERT' then
    v_action    := 'insert';
    v_row_id    := (NEW).id;
    v_stable_id := (NEW).stable_id;
    v_summary   := 'created';
  elsif TG_OP = 'UPDATE' then
    v_action    := 'update';
    v_row_id    := (NEW).id;
    v_stable_id := (NEW).stable_id;
    v_summary   := 'updated';
    if TG_TABLE_NAME = 'lessons' then
      if (OLD).status is distinct from (NEW).status then
        v_summary := 'status: ' || (OLD).status || ' → ' || (NEW).status;
      elsif (OLD).starts_at is distinct from (NEW).starts_at then
        v_summary := 'rescheduled';
      elsif (OLD).price is distinct from (NEW).price then
        v_summary := 'price changed: ' || (OLD).price::text || ' → ' || (NEW).price::text;
      end if;
    end if;
  elsif TG_OP = 'DELETE' then
    v_action    := 'delete';
    v_row_id    := (OLD).id;
    v_stable_id := (OLD).stable_id;
    v_summary   := 'deleted';
  end if;

  -- Teardown guard: during whole-stable deletion the stable row is gone before
  -- its children cascade; logging those deletes would violate the audit FK.
  if TG_OP = 'DELETE' and (v_stable_id is null or not exists (select 1 from stables where id = v_stable_id)) then
    return OLD;
  end if;

  insert into audit_log (
    stable_id, actor_profile_id, actor_role,
    table_name, row_id, action, changes_summary
  )
  values (
    v_stable_id, current_user_id(), current_user_role(),
    TG_TABLE_NAME, v_row_id, v_action, v_summary
  );
  return coalesce(NEW, OLD);
end $function$;
