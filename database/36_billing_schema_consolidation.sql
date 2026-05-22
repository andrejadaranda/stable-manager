-- =============================================================
-- 36_billing_schema_consolidation.sql
--
-- Purpose: resolve the billing schema split-brain introduced by
-- migrations 16 + 32 (and the bundled APPLY_ALL_PENDING.sql which
-- re-applied 32's columns).
--
-- After migration 16 we had:
--   stables.plan                stable_plan enum  (canonical)
--   stables.trial_ends_at       timestamptz       (canonical)
--   stables.stripe_customer_id  text unique
--   subscriptions table         (canonical record, with RLS)
--   subscription_status enum    (canonical)
--
-- After migration 32 (and APPLY_ALL_PENDING) we ALSO had:
--   stables.current_plan        text  check(starter|pro|premium)
--   stables.trial_end_at        timestamptz
--   stables.subscription_status text  check(trialing|active|...)
--
-- That's three places tracking plan, two places tracking trial end,
-- two places tracking subscription status, with overlapping but
-- non-identical vocabularies.
--
-- This migration:
--   1. Backfills the duplicates INTO the canonical (mig-16) shape.
--   2. Drops the redundant text columns + check constraints + indexes.
--   3. Leaves stripe_customer_id alone (already idempotent).
--   4. Adds a small set of comments so the next reader knows which
--      column is canonical and which is gone.
--
-- It is safe to run on a database that:
--   - has only migration 16 applied (does nothing — all DROPs are
--     guarded with IF EXISTS / IF NOT EXISTS)
--   - has both 16 + 32 applied (does the consolidation)
--   - has 32 applied without the subscriptions table yet (very unlikely)
--
-- It is intentionally NOT a transaction-wrapped block — the operator
-- runs this in Supabase SQL Editor and can inspect intermediate state
-- if something looks wrong. There is one DDL action per logical step.
-- =============================================================

-- -------------------------------------------------------------
-- Step 0: safety guard — refuse to run if the canonical columns
-- from migration 16 are missing. (You'd hit this if 16 was somehow
-- skipped while 32 ran.)
-- -------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'stables'
      and column_name  = 'plan'
  ) then
    raise exception 'Migration 16 has not been applied (stables.plan missing). Run 16_subscriptions.sql first.';
  end if;
end $$;

-- -------------------------------------------------------------
-- Step 1: backfill canonical from duplicates, where duplicates exist.
-- We only run each UPDATE if the duplicate column exists, so this is
-- safe on clean (post-16-only) databases too.
-- -------------------------------------------------------------

-- 1a. stables.current_plan (text) -> stables.plan (stable_plan enum)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'stables'
      and column_name  = 'current_plan'
  ) then
    -- Map text values to enum. Anything not in the allowed list stays as 'trial'.
    update stables
       set plan = case current_plan
                    when 'starter' then 'starter'::stable_plan
                    when 'pro'     then 'pro'::stable_plan
                    when 'premium' then 'premium'::stable_plan
                    else plan
                  end
     where current_plan is not null;
  end if;
end $$;

-- 1b. stables.trial_end_at -> stables.trial_ends_at
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'stables'
      and column_name  = 'trial_end_at'
  ) then
    update stables
       set trial_ends_at = coalesce(trial_ends_at, trial_end_at)
     where trial_end_at is not null;
  end if;
end $$;

-- 1c. stables.subscription_status (text) -> subscriptions.status (enum).
-- The canonical place for status is the subscriptions table. Every
-- stable already has a row there because of the migration-16 trigger
-- handle_new_stable_subscription(). If for some reason a stable does
-- NOT have a row, we create one.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'stables'
      and column_name  = 'subscription_status'
  ) then
    -- Make sure every stable has a subscriptions row.
    insert into subscriptions (stable_id, plan, status, current_period_end)
    select s.id,
           coalesce(s.plan, 'trial'::stable_plan),
           'trialing'::subscription_status,
           coalesce(s.trial_ends_at, now() + interval '14 days')
      from stables s
      left join subscriptions sub on sub.stable_id = s.id
     where sub.id is null;

    -- Backfill status into the canonical subscriptions table.
    -- mig-32 used 'canceled' (one l); mig-16 enum has both 'cancelled' (two l).
    update subscriptions sub
       set status = case st.subscription_status
                      when 'trialing'   then 'trialing'::subscription_status
                      when 'active'     then 'active'::subscription_status
                      when 'past_due'   then 'past_due'::subscription_status
                      when 'canceled'   then 'cancelled'::subscription_status
                      when 'incomplete' then 'unpaid'::subscription_status
                      else sub.status
                    end
      from stables st
     where sub.stable_id = st.id
       and st.subscription_status is not null;
  end if;
end $$;

-- -------------------------------------------------------------
-- Step 2: drop the duplicate columns, their constraints, indexes.
-- We drop indexes first (some PG versions complain otherwise),
-- then constraints, then columns.
-- -------------------------------------------------------------

drop index if exists stables_subscription_status_idx;

-- stables_stripe_customer_idx is the redundant index added by
-- migration 32 alongside the original `unique` from migration 16.
-- The migration-16 unique constraint already covers this — drop the
-- partial unique index to leave only one canonical lookup path.
drop index if exists stables_stripe_customer_idx;

alter table stables
  drop constraint if exists stables_subscription_status_check,
  drop constraint if exists stables_current_plan_check;

alter table stables
  drop column if exists current_plan,
  drop column if exists trial_end_at,
  drop column if exists subscription_status;

-- -------------------------------------------------------------
-- Step 3: canonical comments. Future readers should not have to
-- excavate two migrations to know what's authoritative.
-- -------------------------------------------------------------
comment on column stables.plan is
  'Canonical plan tier (enum stable_plan). Mirrored from subscriptions.plan by the Stripe webhook for fast UI reads. Do NOT add another text plan column.';
comment on column stables.trial_ends_at is
  'Canonical trial-end timestamp. The subscription gating helper reads from here.';
comment on column stables.stripe_customer_id is
  'Stripe customer id. Set on first checkout. UNIQUE via the constraint added in migration 16.';
comment on table subscriptions is
  'Canonical billing record. One row per stable. Source of truth for subscription state — stables.plan mirrors it for fast reads.';

-- -------------------------------------------------------------
-- Step 4: verification (run by the operator after applying).
--   select column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'stables'
--      and column_name in ('plan','trial_ends_at','stripe_customer_id',
--                          'current_plan','trial_end_at','subscription_status');
--   -- Expect exactly the first three. The last three should be gone.
--
--   select stable_id, plan, status, current_period_end
--     from subscriptions order by created_at limit 5;
--   -- Expect one row per stable, status using canonical enum spelling.
-- -------------------------------------------------------------

-- =============================================================
-- DONE.
-- =============================================================
