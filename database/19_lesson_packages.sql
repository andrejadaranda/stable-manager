-- =============================================================
-- 19_lesson_packages.sql
--
-- Lesson packages — prepaid bundles (e.g., "8 lessons / month").
-- The most common stable billing model in the Baltics: a client buys
-- a pack of lessons up-front; each scheduled / completed / no-show
-- lesson consumes one slot; cancelled lessons release the slot back.
--
-- Decisions baked in here:
--   1. Cancelled lessons do NOT consume the package (refunded).
--   2. No-show lessons DO consume (client at fault).
--   3. Packages may have an optional expires_at; null = never.
--   4. Multiple packages per client are allowed; the service layer
--      picks the oldest non-expired with remaining > 0 by default.
--   5. The upfront package payment lives in `payments` with a new
--      `package_id` column linking it to the package row, so revenue
--      reporting still works without special cases.
--   6. RLS mirrors payments: OWNER writes, owner+client read,
--      employees can READ (so they can apply a package to a lesson)
--      but cannot CREATE/EDIT packages.
--
-- Pure additive: no data migration; existing rows untouched.
-- =============================================================

-- ---------------- TABLE ----------------
create table lesson_packages (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  client_id       uuid not null references clients(id) on delete restrict,
  total_lessons   int  not null check (total_lessons > 0),
  price           numeric(10,2) not null check (price >= 0),
  purchased_at    timestamptz not null default now(),
  expires_at      timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Optional: expires_at, if set, must be after purchased_at.
  check (expires_at is null or expires_at > purchased_at)
);
create index on lesson_packages(stable_id, client_id, purchased_at desc);
create index on lesson_packages(stable_id, expires_at) where expires_at is not null;

-- ---------------- COLUMNS ON EXISTING TABLES ----------------
alter table lessons  add column package_id uuid references lesson_packages(id) on delete set null;
alter table payments add column package_id uuid references lesson_packages(id) on delete set null;

create index on lessons(package_id)  where package_id is not null;
create index on payments(package_id) where package_id is not null;

-- ---------------- updated_at TRIGGER ----------------
create trigger trg_lesson_packages_updated
  before update on lesson_packages
  for each row execute function set_updated_at();

-- ---------------- SAME-STABLE ENFORCEMENT ----------------
-- Mirror the pattern used for lessons / payments / expenses.
create or replace function lesson_packages_enforce_same_stable() returns trigger
language plpgsql as $$
declare c_stable uuid;
begin
  select stable_id into c_stable from clients where id = new.client_id;
  if c_stable is null or c_stable <> new.stable_id then
    raise exception 'client % does not belong to stable %', new.client_id, new.stable_id;
  end if;
  return new;
end $$;

create trigger lesson_packages_same_stable
  before insert or update on lesson_packages
  for each row execute function lesson_packages_enforce_same_stable();

-- Extend the lessons trigger so that if package_id is set, the package
-- belongs to the same client and stable as the lesson.
create or replace function lessons_enforce_same_stable() returns trigger
language plpgsql as $$
declare h_stable uuid; c_stable uuid; t_stable uuid;
        p_stable uuid; p_client uuid;
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

  return new;
end $$;

-- Same idea for payments.package_id.
create or replace function payments_enforce_same_stable() returns trigger
language plpgsql as $$
declare c_stable uuid; l_stable uuid; l_client uuid;
        p_stable uuid; p_client uuid;
begin
  select stable_id into c_stable from clients where id = new.client_id;
  if c_stable is null or c_stable <> new.stable_id then
    raise exception 'client % does not belong to stable %', new.client_id, new.stable_id; end if;

  if new.lesson_id is not null then
    select stable_id, client_id into l_stable, l_client from lessons where id = new.lesson_id;
    if l_stable is null or l_stable <> new.stable_id then
      raise exception 'lesson % does not belong to stable %', new.lesson_id, new.stable_id; end if;
    if l_client <> new.client_id then
      raise exception 'lesson % belongs to a different client', new.lesson_id; end if;
  end if;

  if new.package_id is not null then
    select stable_id, client_id into p_stable, p_client
      from lesson_packages where id = new.package_id;
    if p_stable is null or p_stable <> new.stable_id then
      raise exception 'package % does not belong to stable %', new.package_id, new.stable_id; end if;
    if p_client <> new.client_id then
      raise exception 'package % belongs to a different client', new.package_id; end if;
  end if;

  return new;
end $$;

-- ---------------- RLS ----------------
alter table lesson_packages enable row level security;
alter table lesson_packages force  row level security;

-- Staff (owner + employee) can read packages so they can apply them
-- to lessons. Clients can read their own packages.
create policy lesson_packages_read_staff on lesson_packages
  for select
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'));

create policy lesson_packages_read_self on lesson_packages
  for select
  using (stable_id = current_stable_id()
         and client_id = current_client_id());

-- WRITE: OWNER only. Packages are a financial transaction; employees
-- shouldn't create or void them.
create policy lesson_packages_write_owner on lesson_packages
  for all
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner')
  with check (stable_id = current_stable_id());

-- ---------------- SUMMARY VIEW ----------------
-- security_invoker = true so the underlying RLS on lesson_packages,
-- lessons, and payments still applies. Returns one row per package
-- with computed used / remaining / paid_amount / is_expired.
create or replace view lesson_package_summary
with (security_invoker = true) as
select
  p.id,
  p.stable_id,
  p.client_id,
  p.total_lessons,
  p.price,
  p.purchased_at,
  p.expires_at,
  p.notes,
  p.created_at,
  p.updated_at,
  -- Used = lessons consuming the package, excluding cancelled.
  coalesce((
    select count(*)::int
    from lessons l
    where l.package_id = p.id
      and l.status in ('scheduled','completed','no_show')
  ), 0) as lessons_used,
  -- Remaining = total - used (clamped at 0; can go negative if owner
  -- force-applies more lessons than the package allows, but UI hides).
  greatest(
    p.total_lessons - coalesce((
      select count(*)::int
      from lessons l
      where l.package_id = p.id
        and l.status in ('scheduled','completed','no_show')
    ), 0),
    0
  ) as lessons_remaining,
  -- Sum of payments tagged with this package_id (the upfront payment).
  coalesce((
    select sum(amount) from payments where package_id = p.id
  ), 0)::numeric(10,2) as paid_amount,
  (p.expires_at is not null and p.expires_at < now()) as is_expired
from lesson_packages p;

grant select on lesson_package_summary to authenticated;

-- =============================================================
-- DONE. Run this script in the Supabase SQL Editor (or
-- supabase db push) to apply.
-- =============================================================
