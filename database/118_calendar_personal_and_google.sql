-- =============================================================
-- 118_calendar_personal_and_google.sql
--
-- Unified-calendar foundation: personal events created inside Longrein
-- + Google Calendar two-way sync, scoped PER USER (not per stable).
--
-- Privacy model: every row here is owned by ONE Longrein user
-- (profiles.id). RLS keys on current_user_id() so User A's private
-- Google / personal events are invisible to User B in the same stable.
-- Stable events (lessons, farrier) keep their existing stable-wide RLS;
-- their Google mirrors are linked via calendar_event_mappings, also
-- per-user (the user who connected Google owns the mirror).
--
-- Google tokens live ONLY in google_calendar_connections and are read
-- exclusively by the service-role client server-side — never exposed to
-- the browser. Loop/dup prevention: calendar_event_mappings + Google
-- extendedProperties.private carry the Longrein identifiers.
--
-- Future-proofing: a `provider` column is kept generic ('google' today)
-- so Apple/Outlook could be added later without a schema rewrite.
--
-- Applied to live DB dluxzjphpokzkrwmmibe. Idempotent.
-- =============================================================

-- ---------- 1. Personal events (user-created + Google-imported) ----------
-- Holds BOTH events the user creates in Longrein and events imported from
-- their Google calendars (source='google'). One place to render all
-- per-user events on the calendar. Overnight events are a single row with
-- true start/end timestamptz crossing midnight.
create table if not exists calendar_personal_events (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  title           text not null,
  event_type      text not null default 'personal'
                    check (event_type in ('personal','work','family','travel','appointment','other')),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  all_day         boolean not null default false,
  notes           text,
  location        text,
  color           text,                       -- optional hex override; else type default
  recurrence      text[],                      -- Google-compatible RRULE lines; null = single
  -- Source + external linkage (inline, 1:1 — this IS the persistent mapping
  -- for personal events; stable events use calendar_event_mappings instead).
  source          text not null default 'longrein' check (source in ('longrein','google')),
  sync_to_google  boolean not null default false,  -- longrein-origin: push to Google?
  provider            text,                    -- 'google' when source='google'
  google_calendar_id  text,
  google_event_id     text,
  google_ical_uid     text,
  google_recurring_event_id text,             -- parent id for recurring instances
  google_updated_at   timestamptz,            -- last known Google 'updated' (loop guard)
  sync_status     text not null default 'ok' check (sync_status in ('ok','pending','error','disconnected')),
  last_synced_at  timestamptz,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (all_day or ends_at > starts_at)
);

create index if not exists cpe_user_range_idx
  on calendar_personal_events (user_id, starts_at);
-- Fast lookup when a Google push notification lands and we reconcile by id.
create unique index if not exists cpe_google_event_uidx
  on calendar_personal_events (user_id, google_calendar_id, google_event_id)
  where google_event_id is not null;

alter table calendar_personal_events enable row level security;

drop policy if exists cpe_owner_all on calendar_personal_events;
create policy cpe_owner_all on calendar_personal_events
  for all
  using      (user_id = current_user_id())
  with check (user_id = current_user_id() and stable_id = current_stable_id());

-- ---------- 2. Google account connection (per user) ----------
-- One connected Google account per Longrein user. Refresh token is the
-- long-lived secret; it is written/read only by the service-role client.
create table if not exists google_calendar_connections (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  stable_id          uuid not null references stables(id) on delete cascade,
  provider           text not null default 'google',
  google_account_email text,
  access_token       text,
  refresh_token      text,
  token_expires_at   timestamptz,
  scopes             text,
  -- Which calendar Longrein writes Longrein-origin events into.
  write_calendar_id  text,
  sync_enabled       boolean not null default true,   -- master Longrein->Google push switch
  -- Per-event-type push toggles (Longrein -> Google).
  push_lessons       boolean not null default true,
  push_training      boolean not null default true,
  push_stable_events boolean not null default true,
  push_competitions  boolean not null default true,
  push_vet           boolean not null default true,
  push_farrier       boolean not null default true,
  push_personal      boolean not null default true,
  status             text not null default 'connected'
                      check (status in ('connected','needs_reauth','revoked','error')),
  last_error         text,
  connected_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, provider)
);

alter table google_calendar_connections enable row level security;

-- The row is visible/editable by its owning user for the non-secret fields
-- (the UI needs email/status/toggles). Token columns are only ever read by
-- the service-role client (which bypasses RLS), never selected in UI code.
drop policy if exists gcc_owner_all on google_calendar_connections;
create policy gcc_owner_all on google_calendar_connections
  for all
  using      (user_id = current_user_id())
  with check (user_id = current_user_id() and stable_id = current_stable_id());

-- ---------- 3. Google calendars on that account ----------
-- The individual calendars (Personal / Family / Work) under a connection,
-- with read/write selection and the per-calendar incremental sync token.
create table if not exists google_calendars (
  id              uuid primary key default gen_random_uuid(),
  connection_id   uuid not null references google_calendar_connections(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  google_calendar_id text not null,
  summary         text,
  background_color text,
  access_role     text,                        -- owner/writer/reader/freeBusyReader
  primary_cal     boolean not null default false,
  read_enabled    boolean not null default false,  -- import into Longrein?
  is_write_target boolean not null default false,  -- receive Longrein-origin events?
  sync_token      text,                            -- incremental events.list token
  sync_token_updated_at timestamptz,
  last_full_sync_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (connection_id, google_calendar_id)
);

create index if not exists gcal_user_idx on google_calendars (user_id);

alter table google_calendars enable row level security;

drop policy if exists gcal_owner_all on google_calendars;
create policy gcal_owner_all on google_calendars
  for all
  using      (user_id = current_user_id())
  with check (user_id = current_user_id());

-- ---------- 4. Stable-event <-> Google mapping ----------
-- Links Longrein STABLE events (lessons today; farrier/competitions later)
-- to their Google mirror, so we don't add Google columns to the lessons
-- table. Personal events carry their linkage inline (table 1); this table
-- is only for events that live in other Longrein tables.
create table if not exists calendar_event_mappings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  stable_id          uuid not null references stables(id) on delete cascade,
  provider           text not null default 'google',
  longrein_kind      text not null check (longrein_kind in ('lesson','farrier','availability')),
  longrein_event_id  uuid not null,
  google_calendar_id text not null,
  google_event_id    text not null,
  google_updated_at  timestamptz,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  unique (user_id, longrein_kind, longrein_event_id, provider)
);

create index if not exists cem_google_idx
  on calendar_event_mappings (user_id, google_calendar_id, google_event_id);

alter table calendar_event_mappings enable row level security;

drop policy if exists cem_owner_all on calendar_event_mappings;
create policy cem_owner_all on calendar_event_mappings
  for all
  using      (user_id = current_user_id())
  with check (user_id = current_user_id() and stable_id = current_stable_id());

-- ---------- 5. Google push (watch) channels ----------
-- One watch channel per watched Google calendar; channels expire and must
-- be renewed before expiration (no auto-renew in the API).
create table if not exists google_sync_channels (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  google_calendar_pk uuid not null references google_calendars(id) on delete cascade,
  channel_id      text not null,               -- our UUID sent as watch id
  resource_id     text,                        -- Google's resource id (for stop)
  channel_token   text,                        -- verification token in X-Goog-Channel-Token
  expiration      timestamptz,
  created_at      timestamptz not null default now(),
  unique (channel_id)
);

create index if not exists gsc_expiry_idx on google_sync_channels (expiration);
create index if not exists gsc_channel_lookup_idx on google_sync_channels (channel_id, channel_token);

alter table google_sync_channels enable row level security;

drop policy if exists gsc_owner_all on google_sync_channels;
create policy gsc_owner_all on google_sync_channels
  for all
  using      (user_id = current_user_id())
  with check (user_id = current_user_id());
