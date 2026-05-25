-- =============================================================
-- 51_rider_pro_client_subscription.sql
-- Rider Pro — €2/mo add-on for clients-in-a-stable.
-- Already applied via Supabase MCP; canonical copy here.
--
-- Owners + employees + Personal account owners get Rider Pro free
-- (bundled with their stable / personal subscription). Only stable
-- CLIENTS need to upgrade separately.
-- =============================================================

alter table clients
  add column if not exists rider_pro_stripe_customer_id     text,
  add column if not exists rider_pro_stripe_subscription_id text,
  add column if not exists rider_pro_status                 text check (
    rider_pro_status is null
    or rider_pro_status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')
  ),
  add column if not exists rider_pro_trial_end              timestamptz,
  add column if not exists rider_pro_period_end             timestamptz,
  add column if not exists rider_pro_cancel_at_period_end   boolean default false;

comment on column clients.rider_pro_status is
  'NULL = never subscribed. trialing = in free trial. active = paid. past_due/canceled/incomplete = inactive.';

create index if not exists idx_clients_rider_pro_sub
  on clients(rider_pro_stripe_subscription_id)
  where rider_pro_stripe_subscription_id is not null;

create index if not exists idx_clients_rider_pro_cus
  on clients(rider_pro_stripe_customer_id)
  where rider_pro_stripe_customer_id is not null;
