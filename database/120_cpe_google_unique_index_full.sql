-- =============================================================
-- 120_cpe_google_unique_index_full.sql
--
-- Fix: the Google-import upsert targets (user_id, google_calendar_id,
-- google_event_id) via ON CONFLICT, but migration 118 created that unique
-- index as PARTIAL (`where google_event_id is not null`). Postgres cannot use
-- a partial index as an ON CONFLICT arbiter unless the statement repeats the
-- predicate — which PostgREST/supabase-js upsert does not — so every imported
-- Google event silently failed to insert ("no unique or exclusion constraint
-- matching the ON CONFLICT specification").
--
-- Replace it with a FULL unique index on the same columns. NULLs are distinct
-- in a unique index, so Longrein-origin rows (google_event_id IS NULL) are
-- unaffected and can still coexist freely.
--
-- Applied to live DB dluxzjphpokzkrwmmibe.
-- =============================================================

drop index if exists cpe_google_event_uidx;
create unique index if not exists cpe_google_event_uidx
  on calendar_personal_events (user_id, google_calendar_id, google_event_id);
