-- =============================================================
-- 16_subscriptions.sql
-- Stripe-backed subscriptions. Adds plan + trial state to stables,
-- creates a 1:1 subscriptions table, RLS so only the owner reads it.
-- All writes happen through the Stripe webhook running as service_role.
-- =============================================================

-- ---------------- Enums ----------------
create type stable_plan as enum (
  'trial', 'starter', 'pro', 'premium', 'cancelled'
);

create type subscription_status as enum (
  'trialing', 'active', 'past_due', 'cancelled', 'unpaid', 'paused'
);

-- ---------------- Stables: plan + trial state ----------------
alter table stables
  add column if not exists plan               stable_plan not null default 'trial',
  add column if not exists trial_ends_at      timestamptz default (now() + interval '14 days'),
  add column if not exists stripe_customer_id text unique;

comment on column stables.plan is
  'Mirror of subscriptions.plan kept on stables for fast reads in the gating helper.';

-- ---------------- Subscriptions ----------------
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  stable_id              uuid not null unique references stables(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  plan                   stable_plan         not null default 'trial',
  status                 subscription_status not null default 'trialing',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at              timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_subscriptions_stable on subscriptions(stable_id);

create trigger trg_subscriptions_updated
  before update on subscriptions
  for each row execute function set_updated_at();

-- ---------------- RLS ----------------
alter table subscriptions enable row level security;

create policy subscriptions_read_owner on subscriptions
  for select
  using (
    stable_id = current_stable_id()
    and current_user_role() = 'owner'
  );

-- No INSERT/UPDATE/DELETE policies for `authenticated`. Stripe webhook
-- writes via the service_role key, which bypasses RLS by design.

-- ---------------- Backfill ----------------
-- Existing stables don't have a subscription row yet. Create a trial
-- row for each so the gating helper has something to read.
insert into subscriptions (stable_id, plan, status, current_period_end)
select s.id, 'trial', 'trialing',
       coalesce(s.trial_ends_at, now() + interval '14 days')
from stables s
left join subscriptions sub on sub.stable_id = s.id
where sub.id is null;

-- Make sure the auto-create-on-stable-insert pattern works for new
-- stables too. If you have a handle_new_stable trigger from a previous
-- migration, this is a no-op; otherwise add one here.
create or replace function handle_new_stable_subscription() returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into subscriptions (stable_id, plan, status, current_period_end)
  values (new.id, 'trial', 'trialing',
          coalesce(new.trial_ends_at, now() + interval '14 days'))
  on conflict (stable_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_stables_init_subscription on stables;
create trigger trg_stables_init_subscription
  after insert on stables
  for each row execute function handle_new_stable_subscription();
