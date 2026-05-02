-- =============================================================
-- 28_audit_log.sql
--
-- Tamper-evident write log. Every insert / update / delete on
-- security-sensitive tables generates one row here, captured by an
-- AFTER trigger. The trigger function is SECURITY DEFINER so it
-- bypasses audit_log RLS to write — but no policy allows users to
-- insert directly, so the only way rows land here is via the trigger.
--
-- What we capture (deliberately minimal):
--   * stable_id        — RLS scope
--   * actor_profile_id — current_user_id() at write time, NULL when
--                        a SECURITY DEFINER call (e.g. provisioning)
--                        ran without a normal user context
--   * actor_role       — owner / employee / client at the moment
--   * table_name       — TG_TABLE_NAME
--   * row_id           — the affected row's id
--   * action           — insert | update | delete
--   * changes_summary  — short human label; richer diffs are a v2 feat
--
-- What we explicitly DON'T capture in v1:
--   * Full column diffs — surfacing them safely needs care (PII!)
--     and a real UI. Skip until customer demand surfaces.
--
-- RLS:
--   * read   : OWNER only
--   * write  : NO policy → only the SECURITY DEFINER trigger writes
-- =============================================================

create table audit_log (
  id                 uuid primary key default gen_random_uuid(),
  stable_id          uuid not null references stables(id) on delete cascade,
  actor_profile_id   uuid references profiles(id) on delete set null,
  actor_role         user_role,
  table_name         text not null,
  row_id             uuid not null,
  action             text not null check (action in ('insert','update','delete')),
  changes_summary    text,
  created_at         timestamptz not null default now()
);
create index on audit_log(stable_id, created_at desc);
create index on audit_log(stable_id, table_name, created_at desc);
create index on audit_log(stable_id, actor_profile_id, created_at desc) where actor_profile_id is not null;

-- ---------------- TRIGGER FUNCTION ----------------
-- SECURITY DEFINER lets it INSERT into audit_log even though no
-- policy permits user writes. set search_path lock + STABLE qualified
-- references in 03_helpers protect against CVE-2018-1058 style
-- shenanigans.
create or replace function record_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
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
    -- Light-weight diff hints for the most-asked-about field changes.
    -- Falls back to "updated" so we never insert a NULL summary.
    if TG_TABLE_NAME = 'lessons' and (OLD).status is distinct from (NEW).status then
      v_summary := 'status: ' || (OLD).status || ' → ' || (NEW).status;
    elsif TG_TABLE_NAME = 'lessons' and (OLD).starts_at is distinct from (NEW).starts_at then
      v_summary := 'rescheduled';
    elsif TG_TABLE_NAME = 'lessons' and (OLD).price is distinct from (NEW).price then
      v_summary := 'price changed: ' || (OLD).price::text || ' → ' || (NEW).price::text;
    else
      v_summary := 'updated';
    end if;
  elsif TG_OP = 'DELETE' then
    v_action    := 'delete';
    v_row_id    := (OLD).id;
    v_stable_id := (OLD).stable_id;
    v_summary   := 'deleted';
  end if;

  -- current_user_id() / current_user_role() come from 03_helpers;
  -- they read the JWT once per statement and return NULL when called
  -- outside an authenticated request (e.g. seed scripts).
  insert into audit_log (
    stable_id, actor_profile_id, actor_role,
    table_name, row_id, action, changes_summary
  )
  values (
    v_stable_id, current_user_id(), current_user_role(),
    TG_TABLE_NAME, v_row_id, v_action, v_summary
  );

  return coalesce(NEW, OLD);
end $$;

-- ---------------- TRIGGERS on the security-relevant tables ----------------
-- Order doesn't matter; AFTER triggers run after the row write.
create trigger audit_lessons               after insert or update or delete on lessons               for each row execute function record_audit_log();
create trigger audit_payments              after insert or update or delete on payments              for each row execute function record_audit_log();
create trigger audit_lesson_packages       after insert or update or delete on lesson_packages       for each row execute function record_audit_log();
create trigger audit_horse_boarding        after insert or update or delete on horse_boarding_charges for each row execute function record_audit_log();
create trigger audit_client_charges        after insert or update or delete on client_charges        for each row execute function record_audit_log();
create trigger audit_client_agreements     after insert or update or delete on client_agreements     for each row execute function record_audit_log();
create trigger audit_services              after insert or update or delete on services              for each row execute function record_audit_log();
create trigger audit_horses                after insert or update or delete on horses                for each row execute function record_audit_log();

-- ---------------- RLS ----------------
alter table audit_log enable row level security;
alter table audit_log force  row level security;

-- Owner only sees the log. No insert / update / delete policies
-- exist, so the only writes possible are from the SECURITY DEFINER
-- trigger above.
create policy audit_log_read_owner on audit_log
  for select
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner');

-- =============================================================
-- DONE. Run this in the Supabase SQL Editor (or supabase db push).
-- =============================================================
