-- =============================================================
-- APPLY_ALL_PENDING.sql
--
-- Combined migration script. Paste THIS WHOLE FILE into Supabase
-- SQL Editor and click Run. Wraps all 6 pending migrations in a
-- single transaction — if any one fails, none is applied, so your
-- DB stays in a known state.
--
-- Migrations included (28 → 33):
--   28: Audit log (tamper-evident write trail)
--   29: Stable features + user onboarded_at
--   30: Emergency / backup contacts on clients + horses
--   31: Waitlist signups table (public anon insert)
--   32: Subscription scaffolding (stripe_customer_id etc.)
--   33: Lesson series id (recurring booking awareness)
--
-- Run order matters because some refs depend on prior tables.
-- This script preserves the order.
-- =============================================================

begin;

-- =============================================================
-- 28: AUDIT LOG
-- =============================================================
create table if not exists audit_log (
  id                 uuid primary key default gen_random_uuid(),
  stable_id          uuid not null references stables(id) on delete cascade,
  actor_profile_id   uuid references profiles(id) on delete set null,
  actor_role         user_role,
  table_name         text not null,
  row_id             uuid not null,
  action             text not null check (action in ('insert','update','delete')),
  changes_summary    text,
  created_at         timestamptz not null default now()
);
create index if not exists audit_log_stable_created_idx on audit_log(stable_id, created_at desc);
create index if not exists audit_log_stable_table_idx   on audit_log(stable_id, table_name, created_at desc);
create index if not exists audit_log_stable_actor_idx   on audit_log(stable_id, actor_profile_id, created_at desc) where actor_profile_id is not null;

create or replace function record_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_stable_id uuid;
  v_action    text;
  v_row_id    uuid;
  v_summary   text;
begin
  if TG_OP = 'INSERT' then
    v_action    := 'insert';
    v_row_id    := (NEW).id;
    v_stable_id := (NEW).stable_id;
    v_summary   := 'created';
  elsif TG_OP = 'UPDATE' then
    v_action    := 'update';
    v_row_id    := (NEW).id;
    v_stable_id := (NEW).stable_id;
    if TG_TABLE_NAME = 'lessons' and (OLD).status is distinct from (NEW).status then
      v_summary := 'status: ' || (OLD).status || ' → ' || (NEW).status;
    elsif TG_TABLE_NAME = 'lessons' and (OLD).starts_at is distinct from (NEW).starts_at then
      v_summary := 'rescheduled';
    elsif TG_TABLE_NAME = 'lessons' and (OLD).price is distinct from (NEW).price then
      v_summary := 'price changed: ' || (OLD).price::text || ' → ' || (NEW).price::text;
    else
      v_summary := 'updated';
    end if;
  elsif TG_OP = 'DELETE' then
    v_action    := 'delete';
    v_row_id    := (OLD).id;
    v_stable_id := (OLD).stable_id;
    v_summary   := 'deleted';
  end if;

  insert into audit_log (
    stable_id, actor_profile_id, actor_role,
    table_name, row_id, action, changes_summary
  )
  values (
    v_stable_id, current_user_id(), current_user_role(),
    TG_TABLE_NAME, v_row_id, v_action, v_summary
  );

  return coalesce(NEW, OLD);
end $$;

drop trigger if exists audit_lessons               on lessons;
drop trigger if exists audit_payments              on payments;
drop trigger if exists audit_lesson_packages       on lesson_packages;
drop trigger if exists audit_horse_boarding        on horse_boarding_charges;
drop trigger if exists audit_client_charges        on client_charges;
drop trigger if exists audit_client_agreements     on client_agreements;
drop trigger if exists audit_services              on services;
drop trigger if exists audit_horses                on horses;

create trigger audit_lessons               after insert or update or delete on lessons               for each row execute function record_audit_log();
create trigger audit_payments              after insert or update or delete on payments              for each row execute function record_audit_log();
create trigger audit_lesson_packages       after insert or update or delete on lesson_packages       for each row execute function record_audit_log();
create trigger audit_horse_boarding        after insert or update or delete on horse_boarding_charges for each row execute function record_audit_log();
create trigger audit_client_charges        after insert or update or delete on client_charges        for each row execute function record_audit_log();
create trigger audit_client_agreements     after insert or update or delete on client_agreements     for each row execute function record_audit_log();
create trigger audit_services              after insert or update or delete on services              for each row execute function record_audit_log();
create trigger audit_horses                after insert or update or delete on horses                for each row execute function record_audit_log();

alter table audit_log enable row level security;
alter table audit_log force  row level security;

drop policy if exists audit_log_read_owner on audit_log;
create policy audit_log_read_owner on audit_log
  for select
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner');

-- =============================================================
-- 29: STABLE FEATURES + ONBOARDED_AT
-- =============================================================
alter table stables
  add column if not exists features jsonb not null default '{
    "sessions":             true,
    "packages":             true,
    "services":             true,
    "boarding":             true,
    "client_charges":       true,
    "reminders":            true,
    "agreements":           true,
    "public_horse_bios":    true,
    "chat":                 true,
    "recurring_lessons":    true,
    "welfare_hard_limits":  true
  }'::jsonb;

update stables
   set features = '{
        "sessions":             true,
        "packages":             true,
        "services":             true,
        "boarding":             true,
        "client_charges":       true,
        "reminders":            true,
        "agreements":           true,
        "public_horse_bios":    true,
        "chat":                 true,
        "recurring_lessons":    true,
        "welfare_hard_limits":  true
       }'::jsonb
 where features is null
    or features = '{}'::jsonb;

alter table profiles
  add column if not exists onboarded_at timestamptz;

-- =============================================================
-- 30: EMERGENCY / BACKUP CONTACTS
-- =============================================================
alter table clients
  add column if not exists emergency_contact_name      text,
  add column if not exists emergency_contact_phone     text,
  add column if not exists emergency_contact_relation  text;

alter table horses
  add column if not exists backup_contact_name      text,
  add column if not exists backup_contact_phone     text,
  add column if not exists backup_contact_relation  text;

-- =============================================================
-- 31: WAITLIST SIGNUPS
-- =============================================================
create table if not exists waitlist_signups (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  source          text,
  yard_size       text,
  country         text,
  confirmed_at    timestamptz,
  created_at      timestamptz not null default now(),
  ip              text,
  user_agent      text
);

-- Unique on lower(email) — wrapping in DO so re-runs don't fail
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where  schemaname = 'public'
      and  tablename  = 'waitlist_signups'
      and  indexname  = 'waitlist_signups_email_unique'
  ) then
    create unique index waitlist_signups_email_unique
      on waitlist_signups ((lower(email)));
  end if;
end $$;

create index if not exists waitlist_signups_created_idx   on waitlist_signups (created_at desc);
create index if not exists waitlist_signups_country_idx   on waitlist_signups (country)  where country is not null;
create index if not exists waitlist_signups_confirmed_idx on waitlist_signups (confirmed_at) where confirmed_at is not null;

alter table waitlist_signups enable row level security;
alter table waitlist_signups force  row level security;

drop policy if exists waitlist_anon_insert on waitlist_signups;
create policy waitlist_anon_insert on waitlist_signups
  for insert
  to anon, authenticated
  with check (
    email is not null
    and length(email) between 5 and 320
    and email like '%@%.%'
  );

-- =============================================================
-- 32: SUBSCRIPTION SCAFFOLDING
-- =============================================================
alter table stables
  add column if not exists stripe_customer_id  text,
  add column if not exists subscription_status text default 'trialing',
  add column if not exists current_plan        text default 'starter',
  add column if not exists trial_end_at        timestamptz default (now() + interval '14 days');

-- Re-add CHECK constraints idempotently
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stables_subscription_status_check') then
    alter table stables add constraint stables_subscription_status_check
      check (subscription_status in ('trialing','active','past_due','canceled','incomplete'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stables_current_plan_check') then
    alter table stables add constraint stables_current_plan_check
      check (current_plan in ('starter','pro','premium'));
  end if;
end $$;

create unique index if not exists stables_stripe_customer_idx
  on stables (stripe_customer_id) where stripe_customer_id is not null;
create index if not exists stables_subscription_status_idx
  on stables (subscription_status, trial_end_at);

-- =============================================================
-- 33: LESSON SERIES
-- =============================================================
alter table lessons
  add column if not exists series_id uuid;

create index if not exists lessons_series_idx
  on lessons (series_id) where series_id is not null;

commit;

-- =============================================================
-- DONE. Verify with:
--   select count(*) from audit_log;                  -- 0 rows ok
--   select features from stables limit 1;            -- jsonb populated
--   select count(*) from waitlist_signups;           -- 0 rows ok
--   select subscription_status, current_plan, trial_end_at from stables limit 1;
-- =============================================================
