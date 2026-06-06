-- =============================================================
-- 67_care_visit_kind.sql
-- Vet visits share the farrier_visits machinery: same scheduling shape,
-- same multi-horse junction (farrier_visit_horses), same owner-visibility
-- RLS from migration 66. A `kind` column distinguishes them; the calendar
-- colors each kind differently (farrier = saddle amber, vet = sky blue).
-- Applied via Supabase MCP; this file is the canonical copy.
-- =============================================================

alter table farrier_visits
  add column if not exists kind text not null default 'farrier';

alter table farrier_visits
  drop constraint if exists farrier_visits_kind_check;
alter table farrier_visits
  add constraint farrier_visits_kind_check check (kind in ('farrier', 'vet'));
