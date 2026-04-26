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
