-- =============================================================
-- 75_availability_blocks.sql
-- Block-out (time-off) times — when the stable/trainer can't take
-- lessons. Rendered red on the calendar. Applied via Supabase MCP;
-- this is the canonical copy.
-- =============================================================

create table if not exists availability_blocks (
  id          uuid primary key default gen_random_uuid(),
  stable_id   uuid not null references stables(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  all_day     boolean not null default false,
  reason      text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

create index if not exists availability_blocks_range_idx
  on availability_blocks (stable_id, starts_at);

alter table availability_blocks enable row level security;

drop policy if exists availability_blocks_staff_all on availability_blocks;
create policy availability_blocks_staff_all on availability_blocks
  for all
  using (
    exists (select 1 from profiles p
      where p.auth_user_id = auth.uid() and p.stable_id = availability_blocks.stable_id
        and p.role in ('owner','employee'))
  )
  with check (
    exists (select 1 from profiles p
      where p.auth_user_id = auth.uid() and p.stable_id = availability_blocks.stable_id
        and p.role in ('owner','employee'))
  );
