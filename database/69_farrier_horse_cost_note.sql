-- =============================================================
-- 69_farrier_horse_cost_note.sql
-- Per-horse cost + note on farrier_visit_horses.
--   cost_cents — what the horse's owner owes for the farrier/vet work
--                on THAT horse (shown as a debt in their portal).
--   note       — what the farrier/vet said about that specific horse.
-- Both nullable. Already surfaced to the owner via the junction RLS
-- from migration 66/68 (read rows for horses they own). Applied via
-- Supabase MCP; this file is the canonical copy.
-- =============================================================

alter table farrier_visit_horses
  add column if not exists cost_cents int,
  add column if not exists note text;
