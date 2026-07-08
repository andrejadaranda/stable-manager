-- =============================================================
-- 99_group_lessons.sql  (applied via Supabase MCP 2026-07-08)
-- Group lessons with per-child pricing + parent billing:
--   lesson_participants.price   — each rider's own price (null = fall back
--                                 to lessons.price); lets some kids get a discount.
--   clients.guardian_client_id  — links a child client to their paying parent
--                                 (self-FK, SET NULL on parent delete) so one
--                                 parent can be billed for all their children.
-- Both additive + nullable — no behaviour change until the group-lesson UI
-- and billing rollup use them.
-- =============================================================
alter table lesson_participants
  add column if not exists price numeric(10,2);

alter table clients
  add column if not exists guardian_client_id uuid references clients(id) on delete set null;

create index if not exists clients_guardian_client_idx on clients (guardian_client_id);

-- A child can be added to a group lesson before a horse is assigned (mount
-- picked later) — allow the participant's horse to be null.
alter table lesson_participants alter column horse_id drop not null;
