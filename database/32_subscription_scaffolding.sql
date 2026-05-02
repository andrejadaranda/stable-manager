-- =============================================================
-- 32_subscription_scaffolding.sql
--
-- Pre-billing scaffolding so the schema is ready when Stripe / Mollie
-- subscription billing wires up. Stripe is the source of truth for
-- the subscription state; we cache the bits we need in our own row
-- so dashboard queries don't have to hit Stripe on every page load.
--
-- Columns:
--   stripe_customer_id    — set at first checkout. Mollie equivalent
--                           if we go Mollie: same column name reused
--                           (it's just the upstream customer id).
--   subscription_status   — 'trialing' | 'active' | 'past_due' |
--                           'canceled' | 'incomplete'. Free-text in
--                           DB; UI maps to friendly labels.
--   current_plan          — 'starter' | 'pro' | 'premium'. Drives
--                           feature gating + UI tier badge.
--   trial_end_at          — when free trial expires. Dashboard nudges
--                           the owner to add a card before this date.
--
-- Privacy: same RLS as stables — owner-only read of their own row.
-- =============================================================

alter table stables
  add column stripe_customer_id  text,
  add column subscription_status text default 'trialing'
    check (subscription_status in ('trialing','active','past_due','canceled','incomplete')),
  add column current_plan        text default 'starter'
    check (current_plan in ('starter','pro','premium')),
  add column trial_end_at        timestamptz default (now() + interval '14 days');

create unique index on stables (stripe_customer_id) where stripe_customer_id is not null;
create index on stables (subscription_status, trial_end_at);

comment on column stables.stripe_customer_id is
  'Upstream payment-processor customer id. NULL until first checkout.';
comment on column stables.subscription_status is
  'Cached subscription state. Source of truth is the payment processor.';
comment on column stables.current_plan is
  'Active plan. Feature gating reads this to enable/disable Pro+ modules.';
comment on column stables.trial_end_at is
  'When the 14-day free trial ends. NULL once converted to paid.';

-- =============================================================
-- DONE. Run this in the Supabase SQL Editor (or supabase db push).
-- =============================================================
