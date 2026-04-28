-- =============================================================
-- 17_horse_health.sql
-- Horse health & care records — vaccinations, farrier visits, vet
-- visits, injuries. One table, one enum, one timeline. Conventions
-- match 02_schema.sql:
--   - tenant root: stable_id on every row
--   - same-stable validation trigger as defense-in-depth
--   - set_updated_at() trigger
--   - role gates via current_user_role()
--
-- Visibility rules (from HORSE_PROFILE_DESIGN.md §4):
--   * Staff (owner + employee) — full read + write
--   * Client (rider, not the horse owner) — NO access (the horse
--     profile screen renders only an abstract status word for them,
--     which is computed in the app layer from no-direct-read data)
--   * Client (horse owner via horses.owner_client_id) — full read,
--     no write (owner can comment via v2 thread, not yet)
-- =============================================================

-- ---------------- ENUM ----------------
create type health_record_kind as enum (
  'vaccination',
  'farrier',
  'vet',
  'injury'
);

-- ---------------- TABLE ----------------
create table horse_health_records (
  id           uuid primary key default gen_random_uuid(),
  stable_id    uuid not null references stables(id) on delete cascade,
  horse_id     uuid not null references horses(id)  on delete cascade,
  kind         health_record_kind not null,
  occurred_on  date not null,
  next_due_on  date,                  -- recurring care: next vaccine, next farrier visit
  resolved_on  date,                  -- injuries: when the horse cleared / returned to work
  title        text not null,         -- short label, e.g. "Annual EHV-1 booster"
  notes        text,                  -- long-form details
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint health_record_title_length check (length(title) between 1 and 200),
  constraint resolved_only_for_injury check (
    resolved_on is null or kind = 'injury'
  ),
  constraint due_only_for_recurring check (
    next_due_on is null or kind in ('vaccination', 'farrier', 'vet')
  )
);

create index idx_health_records_horse_occurred
  on horse_health_records(horse_id, occurred_on desc);
create index idx_health_records_stable_due
  on horse_health_records(stable_id, kind, next_due_on)
  where next_due_on is not null;

-- ---------------- updated_at trigger ----------------
create trigger trg_horse_health_records_updated
  before update on horse_health_records
  for each row execute function set_updated_at();

-- ---------------- same-stable validation ----------------
create or replace function horse_health_records_enforce_same_stable() returns trigger
language plpgsql as $$
declare h_stable uuid; p_stable uuid;
begin
  select stable_id into h_stable from horses where id = new.horse_id;
  if h_stable is null or h_stable <> new.stable_id then
    raise exception 'horse % does not belong to stable %', new.horse_id, new.stable_id;
  end if;
  if new.created_by is not null then
    select stable_id into p_stable from profiles where id = new.created_by;
    if p_stable is null or p_stable <> new.stable_id then
      raise exception 'creator does not belong to stable';
    end if;
  end if;
  return new;
end $$;

create trigger horse_health_records_same_stable
  before insert or update on horse_health_records
  for each row execute function horse_health_records_enforce_same_stable();

-- =============================================================
-- RLS
-- =============================================================
alter table horse_health_records enable row level security;
alter table horse_health_records force row level security;

-- Staff (owner + employee) — full read + write within their stable.
create policy horse_health_records_read_staff on horse_health_records
  for select
  using (
    stable_id = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  );

create policy horse_health_records_write_staff on horse_health_records
  for all
  using (
    stable_id = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  )
  with check (
    stable_id = current_stable_id()
  );

-- Horse-owner client — read-only, only their owned horses' records.
-- Pattern mirrors sessions_read_own_horse_owner from 15_horse_owner.sql.
create policy horse_health_records_read_owner_client on horse_health_records
  for select
  using (
    stable_id = current_stable_id()
    and current_user_role() = 'client'
    and current_client_id() is not null
    and exists (
      select 1 from horses h
      where h.id = horse_health_records.horse_id
        and h.owner_client_id = current_client_id()
    )
  );

-- Note: rider-clients (who do NOT own the horse) get no access. The
-- horse profile screen computes their status display ("Healthy" /
-- "Limited" / "Resting") in the app layer from a separate, abstracted
-- aggregate that does not require reading individual records. That
-- aggregate is built on top of horses.active and a future horses.work_status
-- column (out of scope for this migration).

-- =============================================================
-- Grants — RLS is the gate, but base privileges are still required.
-- =============================================================
grant select, insert, update, delete on horse_health_records to authenticated;
