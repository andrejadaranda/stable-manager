-- =============================================================
-- 66_farrier_visits.sql
-- Farrier visits as schedulable calendar events with multiple horses.
--
-- Unlike horse_health_records (an after-the-fact audit log keyed on a
-- single date), a farrier_visit is a FUTURE calendar appointment with a
-- time window: "farrier coming Tue 10:00, shoeing Bella + Max + Rio".
-- One visit -> many horses (farrier_visit_horses junction).
--
-- Owner visibility: if an attached horse is owned by a client
-- (horses.owner_client_id), that client sees the visit in their own
-- calendar (/dashboard/my-lessons) via RLS — even though they are not
-- stable staff. Mirrors horse_health_records_read_owner_client (17) and
-- sessions_read_own_horse_owner (15).
--
-- Conventions match 02_schema.sql / 17_horse_health.sql:
--   tenant root stable_id on every row; set_updated_at() trigger;
--   role gates via current_user_role(); owner via current_client_id().
-- =============================================================

create table if not exists farrier_visits (
  id           uuid primary key default gen_random_uuid(),
  stable_id    uuid not null references stables(id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  farrier_name text,
  notes        text,
  status       text not null default 'scheduled',  -- scheduled | completed | cancelled
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists farrier_visits_stable_time_idx
  on farrier_visits (stable_id, starts_at);

drop trigger if exists farrier_visits_set_updated_at on farrier_visits;
create trigger farrier_visits_set_updated_at
  before update on farrier_visits
  for each row execute function set_updated_at();

-- Junction: which horses are being shod in this visit.
create table if not exists farrier_visit_horses (
  visit_id uuid not null references farrier_visits(id) on delete cascade,
  horse_id uuid not null references horses(id)         on delete cascade,
  primary key (visit_id, horse_id)
);
create index if not exists farrier_visit_horses_horse_idx
  on farrier_visit_horses (horse_id);

-- =============================================================
-- RLS — farrier_visits
-- =============================================================
alter table farrier_visits enable row level security;
alter table farrier_visits force  row level security;

-- Staff (owner + employee) — full read + write within their stable.
create policy farrier_visits_read_staff on farrier_visits
  for select
  using (
    stable_id = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  );

create policy farrier_visits_write_staff on farrier_visits
  for all
  using (
    stable_id = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  )
  with check (
    stable_id = current_stable_id()
  );

-- Horse-owner client — read-only, visits that include a horse they own.
create policy farrier_visits_read_owner_client on farrier_visits
  for select
  using (
    stable_id = current_stable_id()
    and current_user_role() = 'client'
    and current_client_id() is not null
    and exists (
      select 1
      from farrier_visit_horses fvh
      join horses h on h.id = fvh.horse_id
      where fvh.visit_id = farrier_visits.id
        and h.owner_client_id = current_client_id()
    )
  );

-- =============================================================
-- RLS — farrier_visit_horses
-- =============================================================
alter table farrier_visit_horses enable row level security;
alter table farrier_visit_horses force  row level security;

-- Staff — full read + write for junction rows in their stable.
create policy fvh_read_staff on farrier_visit_horses
  for select
  using (
    current_user_role() in ('owner', 'employee')
    and exists (
      select 1 from farrier_visits v
      where v.id = farrier_visit_horses.visit_id
        and v.stable_id = current_stable_id()
    )
  );

create policy fvh_write_staff on farrier_visit_horses
  for all
  using (
    current_user_role() in ('owner', 'employee')
    and exists (
      select 1 from farrier_visits v
      where v.id = farrier_visit_horses.visit_id
        and v.stable_id = current_stable_id()
    )
  )
  with check (
    current_user_role() in ('owner', 'employee')
    and exists (
      select 1 from farrier_visits v
      where v.id = farrier_visit_horses.visit_id
        and v.stable_id = current_stable_id()
    )
  );

-- Horse-owner client — read-only, junction rows for their owned horses.
create policy fvh_read_owner_client on farrier_visit_horses
  for select
  using (
    current_user_role() = 'client'
    and current_client_id() is not null
    and exists (
      select 1 from horses h
      where h.id = farrier_visit_horses.horse_id
        and h.owner_client_id = current_client_id()
    )
  );
