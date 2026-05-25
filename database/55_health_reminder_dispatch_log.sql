-- =============================================================
-- 55_health_reminder_dispatch_log.sql
-- Sprint 4 "Equilab killer" #5 — vet/farrier journal already exists
-- (migration 17 horse_health_records w/ next_due_on column), but
-- nothing reminded the stable owner that a horse's vaccination /
-- shoeing was due. Equilab + Equestrian App both expose this; we
-- now match.
--
-- Schema mirrors reminder_dispatch_log (#46): dedupe key is
-- (record_id, days_before, channel). Cron fires at 7, 3, 1 days
-- before next_due_on — one row per (record, window).
--
-- Already applied via Supabase MCP. This file is the canonical
-- source-of-truth copy.
-- =============================================================

create table if not exists health_reminder_dispatch_log (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  record_id       uuid not null references horse_health_records(id) on delete cascade,
  horse_id        uuid not null references horses(id) on delete cascade,
  channel         reminder_channel not null,
  /** Days ahead of next_due_on that this reminder represented. */
  days_before     int  not null check (days_before in (1, 3, 7)),
  status          reminder_status not null default 'queued',
  provider_id     text,
  error_message   text,
  message_body    text check (length(coalesce(message_body, '')) <= 2048),
  created_at      timestamptz not null default now(),

  constraint health_reminder_dispatch_unique
    unique (record_id, channel, days_before)
);

create index if not exists health_reminder_dispatch_stable_status
  on health_reminder_dispatch_log (stable_id, status, created_at desc);
create index if not exists health_reminder_dispatch_record
  on health_reminder_dispatch_log (record_id);

comment on table health_reminder_dispatch_log is
  'Per-window dedupe log for horse-health due-date reminders (vaccination, farrier, vet). Mirrors reminder_dispatch_log for lessons. Service-role write only.';

-- Same-stable trigger
create or replace function health_reminder_dispatch_enforce_same_stable()
returns trigger language plpgsql as $$
declare s uuid;
begin
  select stable_id into s from horse_health_records where id = new.record_id;
  if s is null or s <> new.stable_id then
    raise exception 'health_reminder_dispatch_log.record_id must belong to the same stable';
  end if;
  select stable_id into s from horses where id = new.horse_id;
  if s is null or s <> new.stable_id then
    raise exception 'health_reminder_dispatch_log.horse_id must belong to the same stable';
  end if;
  return new;
end $$;

drop trigger if exists trg_health_reminder_dispatch_same_stable on health_reminder_dispatch_log;
create trigger trg_health_reminder_dispatch_same_stable
  before insert or update on health_reminder_dispatch_log
  for each row execute function health_reminder_dispatch_enforce_same_stable();

alter table health_reminder_dispatch_log enable row level security;
alter table health_reminder_dispatch_log force  row level security;

drop policy if exists health_reminder_dispatch_log_read on health_reminder_dispatch_log;
create policy health_reminder_dispatch_log_read on health_reminder_dispatch_log
  for select
  using (stable_id = current_stable_id()
         and exists (select 1 from profiles
                      where id = current_user_id() and role = 'owner'));
