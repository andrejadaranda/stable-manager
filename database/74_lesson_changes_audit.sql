-- =============================================================
-- 74_lesson_changes_audit.sql
-- Lesson change history — a human-readable audit trail of edits
-- (time/day moved, status, price changes). Applied via Supabase MCP;
-- this is the canonical copy.
-- =============================================================

create table if not exists lesson_changes (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references lessons(id) on delete cascade,
  stable_id   uuid not null references stables(id) on delete cascade,
  changed_by  uuid,
  summary     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists lesson_changes_lesson_idx on lesson_changes (lesson_id, created_at desc);

alter table lesson_changes enable row level security;

drop policy if exists lesson_changes_staff_all on lesson_changes;
create policy lesson_changes_staff_all on lesson_changes
  for all
  using (
    exists (select 1 from profiles p
      where p.auth_user_id = auth.uid() and p.stable_id = lesson_changes.stable_id
        and p.role in ('owner','employee'))
  )
  with check (
    exists (select 1 from profiles p
      where p.auth_user_id = auth.uid() and p.stable_id = lesson_changes.stable_id
        and p.role in ('owner','employee'))
  );
