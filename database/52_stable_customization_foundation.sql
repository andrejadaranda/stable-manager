-- =============================================================
-- 52_stable_customization_foundation.sql
-- Sprint 1 — per-stable customization foundation.
-- Already applied via Supabase MCP; canonical copy here.
-- =============================================================

-- Brand kit on stables (logo + brand color)
alter table stables
  add column if not exists brand_color text check (
    brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'
  ),
  add column if not exists logo_url text;

comment on column stables.brand_color is 'Hex color (#RRGGBB) applied to share cards, email accents, app header.';
comment on column stables.logo_url    is 'Logo URL used in emails + share cards. NULL = default Longrein wordmark.';

-- Custom session types per stable
create table if not exists stable_session_types (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  label           text not null,
  color           text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order      int  not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_stable_session_types_stable on stable_session_types(stable_id, sort_order);

create trigger trg_stable_session_types_updated
  before update on stable_session_types
  for each row execute function set_updated_at();

alter table stable_session_types enable  row level security;
alter table stable_session_types force   row level security;

create policy stable_session_types_read  on stable_session_types
  for select using (stable_id = current_stable_id());
create policy stable_session_types_write on stable_session_types
  for all
  using (stable_id = current_stable_id() and current_user_role() = 'owner')
  with check (stable_id = current_stable_id() and current_user_role() = 'owner');

-- Custom lesson types (with pricing rules)
create table if not exists stable_lesson_types (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  label           text not null,
  default_price   numeric(10,2),
  duration_min    int  not null default 60,
  color           text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order      int  not null default 0,
  active          boolean not null default true,
  pricing_rules   jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_stable_lesson_types_stable on stable_lesson_types(stable_id, sort_order);

create trigger trg_stable_lesson_types_updated
  before update on stable_lesson_types
  for each row execute function set_updated_at();

alter table stable_lesson_types enable  row level security;
alter table stable_lesson_types force   row level security;

create policy stable_lesson_types_read  on stable_lesson_types
  for select using (stable_id = current_stable_id());
create policy stable_lesson_types_write on stable_lesson_types
  for all
  using (stable_id = current_stable_id() and current_user_role() = 'owner')
  with check (stable_id = current_stable_id() and current_user_role() = 'owner');

-- Working hours per day-of-week
create table if not exists stable_working_hours (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  day_of_week     smallint not null check (day_of_week between 0 and 6),
  open_time       time not null,
  close_time      time not null check (close_time > open_time),
  created_at      timestamptz not null default now(),
  unique (stable_id, day_of_week)
);

alter table stable_working_hours enable row level security;
alter table stable_working_hours force  row level security;

create policy stable_working_hours_read  on stable_working_hours
  for select using (stable_id = current_stable_id());
create policy stable_working_hours_write on stable_working_hours
  for all
  using (stable_id = current_stable_id() and current_user_role() = 'owner')
  with check (stable_id = current_stable_id() and current_user_role() = 'owner');

-- Holiday / closed dates
create table if not exists stable_holidays (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  closed_date     date not null,
  label           text,
  created_at      timestamptz not null default now(),
  unique (stable_id, closed_date)
);

create index if not exists idx_stable_holidays_stable on stable_holidays(stable_id, closed_date);

alter table stable_holidays enable row level security;
alter table stable_holidays force  row level security;

create policy stable_holidays_read  on stable_holidays
  for select using (stable_id = current_stable_id());
create policy stable_holidays_write on stable_holidays
  for all
  using (stable_id = current_stable_id() and current_user_role() = 'owner')
  with check (stable_id = current_stable_id() and current_user_role() = 'owner');
