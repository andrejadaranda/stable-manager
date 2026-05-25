-- =============================================================
-- 56_stable_weather_alerts.sql
-- Sprint 4 "Equilab killer" #7 — Equestrian App ships weather alerts
-- (blanket / freeze / heat). Grooms care about this; one OpenWeather
-- API call per stable/day. Per-stable opt-in (lat/lng + thresholds);
-- silent skip when unconfigured.
--
-- Storage: extend `stables` with weather config + dedupe log keyed
-- on (stable_id, alert_date, kind) so cron stays idempotent.
--
-- Already applied via Supabase MCP. This file is the canonical
-- source-of-truth copy.
-- =============================================================

alter table stables
  add column if not exists weather_lat              numeric(8, 5),
  add column if not exists weather_lng              numeric(8, 5),
  /** Notify when forecast low <= this (°C). Default 0 = freeze. */
  add column if not exists weather_freeze_below_c   numeric(4, 1),
  /** Notify when forecast high >= this (°C). Default 28 = heat. */
  add column if not exists weather_heat_above_c     numeric(4, 1),
  /** Master toggle — staff can disable entirely without losing thresholds. */
  add column if not exists weather_alerts_enabled   boolean not null default false;

comment on column stables.weather_lat is
  'Latitude (decimal) for OpenWeather lookup. Null = weather alerts disabled.';
comment on column stables.weather_lng is
  'Longitude (decimal). Both lat+lng must be present for any alert to fire.';
comment on column stables.weather_freeze_below_c is
  'Notify staff when 24h forecast low <= this Celsius value. Null disables freeze alerts.';
comment on column stables.weather_heat_above_c is
  'Notify staff when 24h forecast high >= this Celsius value. Null disables heat alerts.';

create type weather_alert_kind as enum ('freeze', 'heat');

create table if not exists weather_alert_dispatch_log (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  alert_date      date not null,
  kind            weather_alert_kind not null,
  forecast_value_c numeric(4, 1) not null,
  status          reminder_status not null default 'sent',
  error_message   text,
  created_at      timestamptz not null default now(),

  constraint weather_alert_dispatch_unique
    unique (stable_id, alert_date, kind)
);

create index if not exists weather_alert_dispatch_stable_status
  on weather_alert_dispatch_log (stable_id, status, created_at desc);

comment on table weather_alert_dispatch_log is
  'Idempotency log for daily weather alerts. One row per (stable, date, kind). Service-role write only.';

alter table weather_alert_dispatch_log enable row level security;
alter table weather_alert_dispatch_log force  row level security;

drop policy if exists weather_alert_dispatch_log_read on weather_alert_dispatch_log;
create policy weather_alert_dispatch_log_read on weather_alert_dispatch_log
  for select
  using (stable_id = current_stable_id()
         and exists (select 1 from profiles
                      where id = current_user_id() and role in ('owner', 'employee')));
