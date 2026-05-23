-- =============================================================
-- 46_reminder_dispatch_log.sql
--
-- Tracks every reminder we've actually sent — keyed by
-- (lesson_id, channel, offset_hours). Prevents the cron from
-- double-firing if it gets re-run, retried, or scaled to >1 worker.
--
-- Without this table the cron job in #34 would have no idempotency
-- guarantee — Twilio bills per SMS, so a double-send is real money
-- plus an annoyed client.
--
-- Schema choices:
--   * `channel` enum mirrors clients.reminder_pref ('email','sms') —
--     'both' explodes into two separate rows so each channel's
--     status is independent (e.g. SMS sent OK, email bounced).
--   * `offset_hours` lets us add multiple reminder windows later
--     (24h before, 2h before, 30min before) without schema change.
--   * `status` captures the end-state from the provider response so
--     we can build "X% delivered last week" health dashboards.
--   * `(lesson_id, channel, offset_hours)` is the unique key — the
--     cron upserts on conflict do nothing, making it safe to retry.
--
-- RLS: owner-readable for their own stable. The cron itself uses the
-- service role, so it bypasses RLS at write time.
-- =============================================================

create type reminder_channel as enum ('email', 'sms');

create type reminder_status as enum (
  'queued',     -- row inserted, not yet handed to provider
  'sent',       -- provider accepted (Twilio 'queued/sending/sent', Resend 'sent')
  'delivered',  -- provider confirmed delivery (Twilio 'delivered', Resend 'delivered')
  'failed',     -- provider rejected (bad number, hard bounce, etc.)
  'skipped'     -- intentionally not sent (lesson cancelled mid-flight, contact missing)
);

create table if not exists reminder_dispatch_log (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  lesson_id       uuid not null references lessons(id) on delete cascade,
  client_id       uuid not null references clients(id) on delete cascade,
  channel         reminder_channel not null,
  /** How many hours before lesson.starts_at this reminder fired. */
  offset_hours    int not null check (offset_hours > 0 and offset_hours <= 168),
  status          reminder_status not null default 'queued',
  /** Provider message id (Twilio SID, Resend id) for trace-back. */
  provider_id     text,
  /** Provider error code/message for failed deliveries. */
  error_message   text,
  /** Render-time copy of the message body, kept for audit + content
   *  template iteration. Stored verbatim — capped at 2 kB. */
  message_body    text check (length(coalesce(message_body, '')) <= 2048),
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz,

  constraint reminder_dispatch_unique
    unique (lesson_id, channel, offset_hours)
);
create index if not exists reminder_dispatch_log_stable_status
  on reminder_dispatch_log (stable_id, status, created_at desc);
create index if not exists reminder_dispatch_log_lesson
  on reminder_dispatch_log (lesson_id);

comment on table reminder_dispatch_log is
  'Append-only log of every reminder dispatched. Provides cron idempotency + delivery audit. Cron writes via service role; owners can read their stable rows via RLS.';

-- Same-stable enforcement
create or replace function reminder_dispatch_enforce_same_stable()
returns trigger language plpgsql as $$
declare s uuid;
begin
  select stable_id into s from lessons where id = new.lesson_id;
  if s is null or s <> new.stable_id then
    raise exception 'reminder_dispatch_log.lesson_id must belong to the same stable';
  end if;
  select stable_id into s from clients where id = new.client_id;
  if s is null or s <> new.stable_id then
    raise exception 'reminder_dispatch_log.client_id must belong to the same stable';
  end if;
  return new;
end $$;

drop trigger if exists trg_reminder_dispatch_same_stable on reminder_dispatch_log;
create trigger trg_reminder_dispatch_same_stable
  before insert or update on reminder_dispatch_log
  for each row execute function reminder_dispatch_enforce_same_stable();

-- RLS — owners read, cron writes via service role (bypasses RLS).
alter table reminder_dispatch_log enable row level security;
alter table reminder_dispatch_log force  row level security;

drop policy if exists reminder_dispatch_log_read on reminder_dispatch_log;
create policy reminder_dispatch_log_read on reminder_dispatch_log
  for select
  using (stable_id = current_stable_id()
         and exists (select 1 from profiles
                      where id = current_user_id() and role = 'owner'));

-- No insert/update/delete policy — service role writes only.
-- =============================================================
-- DONE. The cron handler in app/api/cron/reminders/route.ts (next
-- commit) reads clients.reminder_pref, joins to upcoming lessons,
-- and writes one row per dispatch attempt here.
-- =============================================================
