-- =============================================================
-- 37_client_reminder_pref.sql
--
-- Adds per-client lesson-reminder channel preference.
-- The reminder *sending* (cron job + Resend/Twilio dispatch) is a
-- separate piece of infra that ships later in #34. This column is the
-- data shape that the create/edit client UI writes into today, so
-- when the cron lands we can immediately start firing reminders for
-- every client whose preference was captured at signup time.
--
-- Why a text column (not enum):
--   * Easy to grow the value set (e.g. add 'whatsapp') without an
--     ALTER TYPE migration that locks the table.
--   * Enums in Postgres can only be appended to, not reordered, so
--     they ossify quickly. A CHECK constraint is the same guarantee
--     at the storage layer with none of the schema lock-in.
--
-- Values:
--   * 'none'  — default. Client is not notified by Longrein.
--   * 'email' — lesson reminders sent to clients.email.
--   * 'sms'   — lesson reminders sent to clients.phone (post-launch).
--   * 'both'  — fire both channels.
--
-- RLS: the existing clients-table policies already cover this column
-- because they don't restrict per-column — owners + employees of the
-- same stable can read/write the full row.
-- =============================================================

alter table clients
  add column if not exists reminder_pref text not null default 'none'
    check (reminder_pref in ('none', 'email', 'sms', 'both'));

comment on column clients.reminder_pref is
  'Lesson reminder channel: none|email|sms|both. SMS dispatch ships in #34.';

-- Optional index — most rows will be 'none' so a partial index keeps
-- the cron query (SELECT clients with reminder_pref != 'none') fast
-- without bloating the index for the common case.
create index if not exists clients_reminder_pref_active
  on clients (stable_id, reminder_pref)
  where reminder_pref <> 'none';

-- =============================================================
-- DONE. Run in Supabase SQL Editor:
--   1. Open https://supabase.com/dashboard/project/jnehysdcohqxbmpfvrhc/sql/new
--   2. Paste this file's contents
--   3. Run
-- Idempotent — safe to re-run.
-- =============================================================
