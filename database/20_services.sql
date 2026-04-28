-- =============================================================
-- 20_services.sql
--
-- Stable services + price list. Owners curate the catalog; trainers
-- pick a service when scheduling a lesson; clients see the menu in
-- the portal.
--
-- The lesson keeps its own `price` column (already there) — picking a
-- service simply seeds that field with the service's base price. The
-- price stays editable per-lesson so a trainer can apply a discount
-- without leaving the calendar.
--
-- RLS:
--   * read   : every member of the stable (owners, employees, clients)
--   * write  : OWNER only
--
-- Pure additive: no data migration; existing lessons untouched.
-- =============================================================

-- ---------------- TABLE ----------------
create table services (
  id                       uuid primary key default gen_random_uuid(),
  stable_id                uuid not null references stables(id) on delete cascade,
  name                     text not null,
  description              text,
  base_price               numeric(10,2) not null check (base_price >= 0),
  default_duration_minutes int  not null default 45 check (default_duration_minutes between 5 and 600),
  active                   boolean not null default true,
  sort_order               int  not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- Same name twice in the same stable would confuse the picker.
  unique (stable_id, name)
);
create index on services(stable_id, active, sort_order);

-- ---------------- LESSON FK ----------------
alter table lessons add column service_id uuid references services(id) on delete set null;
create index on lessons(service_id) where service_id is not null;

-- ---------------- updated_at TRIGGER ----------------
create trigger trg_services_updated
  before update on services
  for each row execute function set_updated_at();

-- ---------------- SAME-STABLE ENFORCEMENT ----------------
-- Lesson.service_id (when set) must point to the same stable.
create or replace function lessons_enforce_same_stable() returns trigger
language plpgsql as $$
declare h_stable uuid; c_stable uuid; t_stable uuid;
        p_stable uuid; p_client uuid;
        s_stable uuid;
begin
  select stable_id into h_stable from horses   where id = new.horse_id;
  select stable_id into c_stable from clients  where id = new.client_id;
  select stable_id into t_stable from profiles where id = new.trainer_id;

  if h_stable is null or h_stable <> new.stable_id then
    raise exception 'horse % does not belong to stable %', new.horse_id, new.stable_id; end if;
  if c_stable is null or c_stable <> new.stable_id then
    raise exception 'client % does not belong to stable %', new.client_id, new.stable_id; end if;
  if t_stable is null or t_stable <> new.stable_id then
    raise exception 'trainer % does not belong to stable %', new.trainer_id, new.stable_id; end if;

  if new.package_id is not null then
    select stable_id, client_id into p_stable, p_client
      from lesson_packages where id = new.package_id;
    if p_stable is null or p_stable <> new.stable_id then
      raise exception 'package % does not belong to stable %', new.package_id, new.stable_id; end if;
    if p_client <> new.client_id then
      raise exception 'package % belongs to a different client', new.package_id; end if;
  end if;

  if new.service_id is not null then
    select stable_id into s_stable from services where id = new.service_id;
    if s_stable is null or s_stable <> new.stable_id then
      raise exception 'service % does not belong to stable %', new.service_id, new.stable_id; end if;
  end if;

  return new;
end $$;

-- ---------------- RLS ----------------
alter table services enable row level security;
alter table services force  row level security;

-- All stable members can read the service catalog (owners, employees,
-- and clients). The portal renders this for clients; the calendar
-- forms render it for staff.
create policy services_read_member on services
  for select
  using (stable_id = current_stable_id());

-- WRITE: OWNER only.
create policy services_write_owner on services
  for all
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner')
  with check (stable_id = current_stable_id());

-- =============================================================
-- DONE. Run this script in the Supabase SQL Editor (or
-- supabase db push) to apply.
-- =============================================================
