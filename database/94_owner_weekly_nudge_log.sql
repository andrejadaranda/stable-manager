-- =============================================================
-- 94_owner_weekly_nudge_log.sql
--
-- Idempotency log for the Monday owner "money + welfare" nudge email
-- (unpaid boarding + horses over the weekly cap). One row per stable
-- per ISO week so the cron never double-sends.
--
-- Cron writes via the service role (bypasses RLS). RLS is enabled with
-- no policy so normal clients can't read it.
-- =============================================================

create table if not exists owner_weekly_nudge_log (
  id          uuid primary key default gen_random_uuid(),
  stable_id   uuid not null references stables(id) on delete cascade,
  week_key    text not null,   -- e.g. "2026-W27"
  status      text not null default 'sent',
  created_at  timestamptz not null default now(),
  unique (stable_id, week_key)
);

alter table owner_weekly_nudge_log enable row level security;

notify pgrst, 'reload schema';
