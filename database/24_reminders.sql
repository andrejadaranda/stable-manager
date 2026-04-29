-- =============================================================
-- 24_reminders.sql
--
-- Apple Reminders–style task list. Anyone in the stable can create
-- a reminder for themselves OR for another stable member (trainer →
-- owner, owner → trainer, trainer → client). Optional due date.
-- Visible on the dashboard. Tap to mark complete — the row stays in
-- the DB but the UI strikes-through and hides it.
--
-- Why not reuse a generic todo list? Because reminders are tied to
-- the stable + the cross-role relationships: a client should be able
-- to see "Bring carrots Saturday" assigned by their trainer, but
-- shouldn't see staff-internal reminders. RLS handles this cleanly.
--
-- RLS:
--   * read   : creator + assignee
--   * insert : any stable member (creator must be self)
--   * update : creator + assignee (so either side can mark complete)
--   * delete : creator only
-- =============================================================

create table reminders (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  -- Who wrote the reminder. Always = current_user_id() at insert time.
  created_by      uuid not null references profiles(id) on delete cascade,
  -- Who has to do the thing. NULL is a self-reminder shorthand and
  -- treated as "= created_by" by the UI.
  assigned_to     uuid references profiles(id) on delete cascade,
  body            text not null check (length(trim(body)) > 0 and length(body) <= 500),
  due_at          timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on reminders(stable_id, assigned_to, completed_at, due_at);
create index on reminders(stable_id, created_by, completed_at, due_at);

create trigger trg_reminders_updated
  before update on reminders
  for each row execute function set_updated_at();

-- ---------------- SAME-STABLE ENFORCEMENT ----------------
create or replace function reminders_enforce_same_stable() returns trigger
language plpgsql as $$
declare s uuid;
begin
  select stable_id into s from profiles where id = new.created_by;
  if s is null or s <> new.stable_id then
    raise exception 'reminders.created_by must belong to the same stable';
  end if;
  if new.assigned_to is not null then
    select stable_id into s from profiles where id = new.assigned_to;
    if s is null or s <> new.stable_id then
      raise exception 'reminders.assigned_to must belong to the same stable';
    end if;
  end if;
  return new;
end $$;

create trigger reminders_same_stable
  before insert or update on reminders
  for each row execute function reminders_enforce_same_stable();

-- ---------------- RLS ----------------
alter table reminders enable row level security;
alter table reminders force  row level security;

-- Read: creator OR assignee. The "assigned_to IS NULL" case (self
-- reminder) is covered because created_by = current_user_id() applies.
create policy reminders_read on reminders
  for select
  using (stable_id = current_stable_id()
         and (created_by = current_user_id()
              or assigned_to = current_user_id()));

-- Insert: any stable member, but they must mark themselves as the
-- creator. assigned_to may be self, another staff member, or a client
-- profile (RLS on the read side handles visibility).
create policy reminders_insert on reminders
  for insert
  with check (stable_id = current_stable_id()
              and created_by = current_user_id());

-- Update: creator OR assignee — either side can flip completed_at,
-- creator can also edit body / due_at.
create policy reminders_update on reminders
  for update
  using (stable_id = current_stable_id()
         and (created_by = current_user_id()
              or assigned_to = current_user_id()))
  with check (stable_id = current_stable_id());

-- Delete: only the creator.
create policy reminders_delete on reminders
  for delete
  using (stable_id = current_stable_id()
         and created_by = current_user_id());

-- =============================================================
-- DONE. Run this in the Supabase SQL Editor (or supabase db push).
-- =============================================================
