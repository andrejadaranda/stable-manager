-- =============================================================
-- 76_push_subscriptions.sql
-- Web Push subscriptions — one row per device a user granted
-- notification permission on. The reminders cron sends 15-min
-- lesson pushes here. Dedup reuses reminder_dispatch_log
-- (channel='push', offset_hours=0.25). Applied via Supabase MCP.
-- =============================================================

create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null,
  stable_id     uuid,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (auth_user_id);

alter table push_subscriptions enable row level security;

drop policy if exists push_subscriptions_own on push_subscriptions;
create policy push_subscriptions_own on push_subscriptions
  for all
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
