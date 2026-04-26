-- ==========================================================
-- install.sql
-- Bundled migrations 01..08. Run once in Supabase SQL Editor.
-- ==========================================================


-- ----------------------------------------------------------
-- 01_extensions.sql
-- ----------------------------------------------------------
-- =============================================================
-- 01_extensions.sql
-- Required Postgres extensions, installed in Supabase's standard
-- `extensions` schema (not `public`) so pg_dump/pg_restore stay clean.
-- =============================================================

create extension if not exists pgcrypto   with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- pgcrypto provides gen_random_uuid().
-- btree_gist enables exclusion constraints that mix uuid + tstzrange,
-- which is how we prevent horse and trainer double-booking on `lessons`.

-- ----------------------------------------------------------
-- 02_schema.sql
-- ----------------------------------------------------------
-- =============================================================
-- 02_schema.sql
-- Tables, enums, indexes, same-stable validation triggers.
-- No subscriptions in MVP. Tenant root: stables. Every tenant
-- table carries stable_id.
-- =============================================================

-- ---------------- ENUMS ----------------
create type user_role        as enum ('owner', 'employee', 'client');
create type lesson_status    as enum ('scheduled', 'completed', 'cancelled', 'no_show');
create type payment_method   as enum ('cash', 'card', 'transfer', 'other');
create type expense_category as enum ('feed', 'vet', 'farrier', 'maintenance', 'staff', 'other');

-- ---------------- STABLES (tenant root) ----------------
create table stables (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  timezone    text not null default 'UTC',
  currency    char(3) not null default 'EUR',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint stables_slug_format check (slug ~ '^[a-z0-9-]{2,40}$')
);

-- ---------------- PROFILES (auth.users <-> stable membership) ----------------
-- Renamed from `users` to avoid collision with auth.users.
-- One auth user belongs to exactly one stable in MVP.
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  stable_id     uuid not null references stables(id) on delete cascade,
  full_name     text,
  role          user_role not null default 'client',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on profiles(stable_id);
create index on profiles(stable_id, role);

-- ---------------- HORSES ----------------
create table horses (
  id                   uuid primary key default gen_random_uuid(),
  stable_id            uuid not null references stables(id) on delete cascade,
  name                 text not null,
  breed                text,
  date_of_birth        date,
  daily_lesson_limit   int  not null default 4,
  weekly_lesson_limit  int  not null default 20,
  active               boolean not null default true,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index on horses(stable_id);
create index on horses(stable_id, active);

-- ---------------- CLIENTS ----------------
-- A client is a stable record. profile_id is optional (portal access link).
create table clients (
  id                    uuid primary key default gen_random_uuid(),
  stable_id             uuid not null references stables(id) on delete cascade,
  profile_id            uuid references profiles(id) on delete set null,
  full_name             text not null,
  email                 text,
  phone                 text,
  default_lesson_price  numeric(10,2),
  active                boolean not null default true,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index on clients(stable_id);
create index on clients(stable_id, active);
create unique index clients_profile_unique on clients(stable_id, profile_id) where profile_id is not null;

-- ---------------- LESSONS (central entity) ----------------
create table lessons (
  id          uuid primary key default gen_random_uuid(),
  stable_id   uuid not null references stables(id) on delete cascade,
  horse_id    uuid not null references horses(id)   on delete restrict,
  client_id   uuid not null references clients(id)  on delete restrict,
  trainer_id  uuid not null references profiles(id) on delete restrict,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  price       numeric(10,2) not null default 0,
  status      lesson_status not null default 'scheduled',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at > starts_at),

  -- DB-level guarantee: a horse cannot be booked into overlapping windows.
  constraint no_horse_double_booking exclude using gist (
    horse_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('scheduled', 'completed')),

  -- Same for trainers.
  constraint no_trainer_double_booking exclude using gist (
    trainer_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('scheduled', 'completed'))
);
create index on lessons(stable_id, starts_at);
create index on lessons(horse_id, starts_at);
create index on lessons(client_id, starts_at);
create index on lessons(trainer_id, starts_at);

-- ---------------- PAYMENTS ----------------
create table payments (
  id          uuid primary key default gen_random_uuid(),
  stable_id   uuid not null references stables(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete restrict,
  lesson_id   uuid references lessons(id) on delete set null,
  amount      numeric(10,2) not null check (amount > 0),
  method      payment_method not null default 'cash',
  paid_at     timestamptz not null default now(),
  notes       text,
  created_at  timestamptz not null default now()
);
create index on payments(stable_id, paid_at desc);
create index on payments(stable_id, client_id);

-- ---------------- EXPENSES ----------------
create table expenses (
  id           uuid primary key default gen_random_uuid(),
  stable_id    uuid not null references stables(id) on delete cascade,
  category     expense_category not null default 'other',
  amount       numeric(10,2) not null check (amount > 0),
  description  text,
  horse_id     uuid references horses(id)   on delete set null,
  incurred_on  date not null default current_date,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);
create index on expenses(stable_id, incurred_on desc);
create index on expenses(stable_id, category);

-- ============================================================
-- updated_at touch trigger
-- ============================================================
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_stables_updated  before update on stables  for each row execute function set_updated_at();
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger trg_horses_updated   before update on horses   for each row execute function set_updated_at();
create trigger trg_clients_updated  before update on clients  for each row execute function set_updated_at();
create trigger trg_lessons_updated  before update on lessons  for each row execute function set_updated_at();

-- ============================================================
-- SAME-STABLE VALIDATION TRIGGERS
-- Defense-in-depth: every cross-table reference must point inside the
-- same stable as the parent row. Triggers run as INVOKER (default) so
-- RLS still applies — a malicious caller cannot reference rows they
-- can't already see.
-- ============================================================

-- Lessons: horse, client, trainer must all belong to the same stable.
create or replace function lessons_enforce_same_stable() returns trigger
language plpgsql as $$
declare h_stable uuid; c_stable uuid; t_stable uuid;
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
  return new;
end $$;

create trigger lessons_same_stable
  before insert or update on lessons
  for each row execute function lessons_enforce_same_stable();

-- Payments: client + (optional) lesson must belong to same stable.
-- Also reject linking a payment to a lesson belonging to a different client.
create or replace function payments_enforce_same_stable() returns trigger
language plpgsql as $$
declare c_stable uuid; l_stable uuid; l_client uuid;
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
  return new;
end $$;

create trigger payments_same_stable
  before insert or update on payments
  for each row execute function payments_enforce_same_stable();

-- Expenses: optional horse + creator profile must belong to same stable.
create or replace function expenses_enforce_same_stable() returns trigger
language plpgsql as $$
declare h_stable uuid; p_stable uuid;
begin
  if new.horse_id is not null then
    select stable_id into h_stable from horses where id = new.horse_id;
    if h_stable is null or h_stable <> new.stable_id then
      raise exception 'horse % does not belong to stable %', new.horse_id, new.stable_id; end if;
  end if;
  if new.created_by is not null then
    select stable_id into p_stable from profiles where id = new.created_by;
    if p_stable is null or p_stable <> new.stable_id then
      raise exception 'creator does not belong to stable'; end if;
  end if;
  return new;
end $$;

create trigger expenses_same_stable
  before insert or update on expenses
  for each row execute function expenses_enforce_same_stable();

-- ----------------------------------------------------------
-- 03_helpers.sql
-- ----------------------------------------------------------
-- =============================================================
-- 03_helpers.sql
-- RLS context helpers. SECURITY DEFINER + STABLE so they run as
-- table owner (bypassing recursive RLS on `profiles`) and are
-- cached per-statement by the planner.
--
-- These four functions are the only place that reads the JWT
-- (auth.uid()). Every policy in 04_policies.sql is built on top.
-- =============================================================

-- The stable the calling auth user belongs to (NULL if none).
create or replace function current_stable_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select stable_id from profiles where auth_user_id = auth.uid() limit 1;
$$;

-- The role of the calling auth user within their stable.
create or replace function current_user_role() returns user_role
  language sql stable security definer set search_path = public as $$
  select role from profiles where auth_user_id = auth.uid() limit 1;
$$;

-- The internal profiles.id of the calling auth user.
create or replace function current_user_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from profiles where auth_user_id = auth.uid() limit 1;
$$;

-- The clients.id linked to the calling auth user (NULL for staff or
-- clients without a portal link).
create or replace function current_client_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select c.id
  from clients c
  join profiles p on p.id = c.profile_id
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

-- Lock these down: only authenticated callers should reach them.
revoke all on function current_stable_id() from public;
revoke all on function current_user_role() from public;
revoke all on function current_user_id()   from public;
revoke all on function current_client_id() from public;

grant execute on function current_stable_id() to authenticated;
grant execute on function current_user_role() to authenticated;
grant execute on function current_user_id()   to authenticated;
grant execute on function current_client_id() to authenticated;

-- ----------------------------------------------------------
-- 04_policies.sql
-- ----------------------------------------------------------
-- =============================================================
-- 04_policies.sql
-- Row Level Security: enable + force on every tenant table, then
-- declare policies. The audit's role-escalation hole (clients
-- updating their own role) is gone: only owners can write profiles.
--
-- Visibility model:
--   stables   : member read; owner update
--   profiles  : staff read all in stable; client read self only;
--               WRITE: owner only (NO self-update -> no role escalation)
--   horses    : staff read+write
--   clients   : staff read+write; client read own row
--   lessons   : staff read+write; client read own
--   payments  : OWNER read+write; client read own
--   expenses  : OWNER read+write
-- =============================================================

-- ---------------- ENABLE + FORCE ----------------
alter table stables  enable row level security;
alter table profiles enable row level security;
alter table horses   enable row level security;
alter table clients  enable row level security;
alter table lessons  enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;

alter table stables  force row level security;
alter table profiles force row level security;
alter table horses   force row level security;
alter table clients  force row level security;
alter table lessons  force row level security;
alter table payments force row level security;
alter table expenses force row level security;

-- ============================================================
-- STABLES
-- ============================================================
create policy stables_read_member on stables
  for select
  using (id = current_stable_id());

create policy stables_update_owner on stables
  for update
  using (id = current_stable_id() and current_user_role() = 'owner')
  with check (id = current_stable_id());

-- ============================================================
-- PROFILES
-- Staff read all in stable; clients read only their own row.
-- WRITE: owner only. No self-update policy, by design — this
-- prevents the role-escalation hole from the audit.
-- ============================================================
create policy profiles_read_staff on profiles
  for select
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'));

create policy profiles_read_self on profiles
  for select
  using (stable_id = current_stable_id()
         and auth_user_id = auth.uid());

create policy profiles_owner_all on profiles
  for all
  using (stable_id = current_stable_id() and current_user_role() = 'owner')
  with check (stable_id = current_stable_id());

-- ============================================================
-- HORSES (staff read + write; clients have no direct access)
-- ============================================================
create policy horses_read_staff on horses
  for select
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'));

create policy horses_write_staff on horses
  for all
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'))
  with check (stable_id = current_stable_id());

-- ============================================================
-- CLIENTS
-- Staff read+write; client reads only own row.
-- ============================================================
create policy clients_read_staff on clients
  for select
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'));

create policy clients_read_self on clients
  for select
  using (stable_id = current_stable_id()
         and id = current_client_id());

create policy clients_write_staff on clients
  for all
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'))
  with check (stable_id = current_stable_id());

-- ============================================================
-- LESSONS (operational calendar)
-- Staff read+write; client reads only own lessons.
-- ============================================================
create policy lessons_read_staff on lessons
  for select
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'));

create policy lessons_read_client on lessons
  for select
  using (stable_id = current_stable_id()
         and client_id = current_client_id());

create policy lessons_write_staff on lessons
  for all
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'))
  with check (stable_id = current_stable_id());

-- ============================================================
-- PAYMENTS
-- OWNER only for read+write. Clients can read their own payments
-- (so the portal balance/history works). Employees: NO access.
-- ============================================================
create policy payments_read_owner on payments
  for select
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner');

create policy payments_read_self on payments
  for select
  using (stable_id = current_stable_id()
         and client_id = current_client_id());

create policy payments_write_owner on payments
  for all
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner')
  with check (stable_id = current_stable_id());

-- ============================================================
-- EXPENSES (owner-only. Employees have no read or write.)
-- ============================================================
create policy expenses_read_owner on expenses
  for select
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner');

create policy expenses_write_owner on expenses
  for all
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner')
  with check (stable_id = current_stable_id());

-- ----------------------------------------------------------
-- 05_functions.sql
-- ----------------------------------------------------------
-- =============================================================
-- 05_functions.sql
-- Business-logic functions and the client account view.
-- All run as SECURITY INVOKER (default) so RLS still applies.
-- =============================================================

-- -------------------------------------------------------------
-- horse_workload: lessons + total minutes ridden in [from, to)
-- -------------------------------------------------------------
create or replace function horse_workload(
  p_horse_id uuid,
  p_from     timestamptz,
  p_to       timestamptz
) returns table (total_lessons bigint, total_minutes bigint)
language sql stable as $$
  select
    count(*)::bigint,
    coalesce(sum(extract(epoch from (ends_at - starts_at)) / 60), 0)::bigint
  from lessons
  where horse_id = p_horse_id
    and status in ('scheduled', 'completed')
    and starts_at >= p_from
    and starts_at <  p_to;
$$;

-- -------------------------------------------------------------
-- horse_is_overworked: daily/weekly cap status for a given date
-- -------------------------------------------------------------
create or replace function horse_is_overworked(p_horse_id uuid, p_on date)
returns table (
  daily_count   bigint,
  daily_limit   int,
  weekly_count  bigint,
  weekly_limit  int,
  over_daily    boolean,
  over_weekly   boolean
) language sql stable as $$
  with h as (
    select daily_lesson_limit, weekly_lesson_limit from horses where id = p_horse_id
  ),
  d as (
    select count(*)::bigint c from lessons
    where horse_id = p_horse_id
      and status in ('scheduled','completed')
      and starts_at::date = p_on
  ),
  w as (
    select count(*)::bigint c from lessons
    where horse_id = p_horse_id
      and status in ('scheduled','completed')
      and starts_at >= date_trunc('week', p_on::timestamptz)
      and starts_at <  date_trunc('week', p_on::timestamptz) + interval '7 days'
  )
  select d.c, h.daily_lesson_limit,
         w.c, h.weekly_lesson_limit,
         d.c >= h.daily_lesson_limit,
         w.c >= h.weekly_lesson_limit
  from h, d, w;
$$;

-- -------------------------------------------------------------
-- client_balance (no subscriptions in MVP)
--   negative => client owes money
--   positive => client has credit
-- -------------------------------------------------------------
create or replace function client_balance(p_client_id uuid)
returns numeric language sql stable as $$
  with charges as (
    select coalesce(sum(price), 0) as total
    from lessons
    where client_id = p_client_id
      and status in ('scheduled', 'completed')
  ),
  paid as (
    select coalesce(sum(amount), 0) as total
    from payments
    where client_id = p_client_id
  )
  select (paid.total - charges.total)::numeric from charges, paid;
$$;

-- -------------------------------------------------------------
-- check_horse_available: friendly preflight before insert.
-- The exclusion constraint on `lessons` is the source of truth;
-- this function exists so the service layer can return a clean
-- error message before attempting the write.
-- -------------------------------------------------------------
create or replace function check_horse_available(
  p_horse_id        uuid,
  p_starts_at       timestamptz,
  p_ends_at         timestamptz,
  p_exclude_lesson  uuid default null
) returns boolean language sql stable as $$
  select not exists (
    select 1 from lessons
    where horse_id = p_horse_id
      and status in ('scheduled', 'completed')
      and (p_exclude_lesson is null or id <> p_exclude_lesson)
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  );
$$;

-- -------------------------------------------------------------
-- client_account_summary view
-- security_invoker = true => underlying tables' RLS applies.
-- -------------------------------------------------------------
create or replace view client_account_summary
with (security_invoker = true) as
select
  c.id                                                       as client_id,
  c.stable_id,
  c.full_name,
  coalesce(charges.amount, 0)                                as total_charged,
  coalesce(paid.amount, 0)                                   as total_paid,
  coalesce(paid.amount, 0) - coalesce(charges.amount, 0)     as balance
from clients c
left join (
  select client_id, sum(price) as amount
  from lessons
  where status in ('scheduled','completed')
  group by client_id
) charges on charges.client_id = c.id
left join (
  select client_id, sum(amount) as amount
  from payments
  group by client_id
) paid on paid.client_id = c.id;

-- Grants
grant execute on function horse_workload(uuid, timestamptz, timestamptz)              to authenticated;
grant execute on function horse_is_overworked(uuid, date)                             to authenticated;
grant execute on function client_balance(uuid)                                        to authenticated;
grant execute on function check_horse_available(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant select   on client_account_summary                                              to authenticated;

-- ----------------------------------------------------------
-- 06_auth.sql
-- ----------------------------------------------------------
-- =============================================================
-- 06_auth.sql
-- Two SECURITY DEFINER RPCs that bridge Supabase Auth to the
-- multi-tenant model:
--
--   provision_stable        -> first-time signup creates a stable
--                              and assigns the caller as 'owner'.
--   attach_user_to_stable   -> owner adds an already-invited
--                              auth user as employee or client.
--                              Hardened: NEVER moves users between
--                              stables. Rejects on any prior membership.
-- =============================================================

-- -------------------------------------------------------------
-- provision_stable: bootstrap a new tenant.
-- The caller must be authenticated and not already a member.
-- -------------------------------------------------------------
create or replace function provision_stable(
  p_stable_name text,
  p_stable_slug text,
  p_full_name   text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_stable_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from profiles where auth_user_id = auth.uid()) then
    raise exception 'user already belongs to a stable';
  end if;

  insert into stables(name, slug)
    values (p_stable_name, p_stable_slug)
    returning id into v_stable_id;

  insert into profiles(auth_user_id, stable_id, full_name, role)
    values (auth.uid(), v_stable_id, p_full_name, 'owner');

  return v_stable_id;
end $$;

revoke all on function provision_stable(text, text, text) from public;
grant execute on function provision_stable(text, text, text) to authenticated;

-- -------------------------------------------------------------
-- attach_user_to_stable: owner adds an invited user.
-- Safety guarantees:
--   * caller MUST be 'owner' of a stable
--   * target auth user MUST exist
--   * target auth user MUST NOT already be a member of any stable
--     (hard reject — no upsert, no cross-stable move)
--   * cannot create another 'owner' through this RPC (only
--     'employee' or 'client' allowed).
--
-- Typical flow:
--   1. server action invokes supabase.auth.admin.inviteUserByEmail
--   2. once invitation creates an auth.users row, server calls this
-- -------------------------------------------------------------
create or replace function attach_user_to_stable(
  p_auth_user_id uuid,
  p_full_name    text,
  p_role         user_role
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_caller_role user_role;
  v_stable_id   uuid;
  v_profile_id  uuid;
begin
  v_caller_role := current_user_role();
  v_stable_id   := current_stable_id();

  if v_caller_role is null or v_caller_role <> 'owner' then
    raise exception 'only owners can attach users';
  end if;

  if v_stable_id is null then
    raise exception 'caller has no stable';
  end if;

  if p_role not in ('employee', 'client') then
    raise exception 'invalid role for attach: %', p_role;
  end if;

  if not exists (select 1 from auth.users where id = p_auth_user_id) then
    raise exception 'auth user does not exist';
  end if;

  -- Hard reject: never move a user between stables.
  if exists (select 1 from profiles where auth_user_id = p_auth_user_id) then
    raise exception 'auth user already belongs to a stable';
  end if;

  insert into profiles(auth_user_id, stable_id, full_name, role)
    values (p_auth_user_id, v_stable_id, p_full_name, p_role)
    returning id into v_profile_id;

  return v_profile_id;
end $$;

revoke all on function attach_user_to_stable(uuid, text, user_role) from public;
grant execute on function attach_user_to_stable(uuid, text, user_role) to authenticated;

-- ----------------------------------------------------------
-- 07_calendar_policies.sql
-- ----------------------------------------------------------
-- =============================================================
-- 07_calendar_policies.sql
-- Required for the client-portal calendar.
--
-- Without this, a client can read their lesson rows but joining
-- to horses/profiles returns null — they can't see the horse name
-- or trainer name on their own lessons.
--
-- These two policies expose ONLY the rows that already appear in a
-- lesson the client owns. No broader roster is exposed.
-- Multiple SELECT policies on a table are OR-combined; staff
-- visibility is unaffected.
-- =============================================================

create policy horses_read_via_own_lesson on horses
  for select using (
    stable_id = current_stable_id()
    and exists (
      select 1 from lessons l
      where l.horse_id  = horses.id
        and l.client_id = current_client_id()
    )
  );

create policy profiles_read_via_own_lesson on profiles
  for select using (
    stable_id = current_stable_id()
    and exists (
      select 1 from lessons l
      where l.trainer_id = profiles.id
        and l.client_id  = current_client_id()
    )
  );

-- ----------------------------------------------------------
-- 08_clients_skill_level.sql
-- ----------------------------------------------------------
-- =============================================================
-- 08_clients_skill_level.sql
-- Adds an optional skill level to clients. Pure additive change —
-- no RLS impact (policies don't reference columns by name) and
-- no data migration needed.
-- =============================================================

create type skill_level as enum ('beginner', 'intermediate', 'advanced', 'pro');

alter table clients add column skill_level skill_level;
