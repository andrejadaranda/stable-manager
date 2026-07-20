-- 104_external_calendar.sql
-- Calendar IMPORT direction: subscribe Longrein to an external read-only .ics
-- feed (e.g. a spouse's work calendar) and write its events into
-- availability_blocks as busy blocks. Tagged so each resync replaces only the
-- imported blocks, never manually-added ones. Applied to live DB
-- dluxzjphpokzkrwmmibe 2026-07-20.

-- Tag imported blocks.
alter table availability_blocks add column if not exists source text not null default 'manual';
alter table availability_blocks add column if not exists external_profile_id uuid;
alter table availability_blocks add column if not exists external_uid text;
create index if not exists availability_blocks_ext_idx
  on availability_blocks (stable_id, source, external_profile_id);

-- One external feed per user.
alter table profiles add column if not exists external_calendar_url        text;
alter table profiles add column if not exists external_calendar_label      text;
alter table profiles add column if not exists external_calendar_synced_at  timestamptz;
alter table profiles add column if not exists external_calendar_status     text;
