-- =============================================================
-- 15_horse_owner.sql
-- "Fast variant" horse-owner support. Adds a clients FK on horses so
-- a client row can be marked as the owner of one or more horses.
-- Extends the sessions RLS so that owners see every session on their
-- horse — not only the ones where they were the rider.
-- =============================================================

-- ---------------- Column ----------------
alter table horses
  add column if not exists owner_client_id uuid references clients(id) on delete set null;

comment on column horses.owner_client_id is
  'The client (boarder) that owns this horse. NULL if the stable owns it. Used by the client portal to surface "horses I own" with full session history.';

create index if not exists idx_horses_owner_client
  on horses(owner_client_id)
  where owner_client_id is not null;

-- Same-stable validation: a horse''s owner_client_id must live in the
-- same stable as the horse. Use a trigger (couldn''t express this in a
-- composite FK without redundant columns).
create or replace function horses_owner_same_stable() returns trigger
language plpgsql
as $$
declare s uuid;
begin
  if new.owner_client_id is null then
    return new;
  end if;
  select stable_id into s from clients where id = new.owner_client_id;
  if s is null or s <> new.stable_id then
    raise exception 'horses: owner_client_id must belong to the same stable';
  end if;
  return new;
end $$;

drop trigger if exists trg_horses_owner_same_stable on horses;
create trigger trg_horses_owner_same_stable
  before insert or update on horses
  for each row execute function horses_owner_same_stable();

-- =============================================================
-- Sessions RLS extension — owners read every session on their horse
-- =============================================================

create policy sessions_read_own_horse_owner on sessions
  for select
  using (
    stable_id = current_stable_id()
    and current_user_role() = 'client'
    and current_client_id() is not null
    and exists (
      select 1 from horses h
      where h.id = sessions.horse_id
        and h.owner_client_id = current_client_id()
    )
  );

-- Note: Postgres applies multiple SELECT policies disjunctively, so this
-- policy is additive to sessions_read_own_client. A client who is BOTH
-- the rider AND the owner sees the row through whichever policy hits
-- first — same effect either way.
