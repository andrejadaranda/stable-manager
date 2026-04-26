-- =============================================================
-- 08_clients_skill_level.sql
-- Adds an optional skill level to clients. Pure additive change —
-- no RLS impact (policies don't reference columns by name) and
-- no data migration needed.
-- =============================================================

create type skill_level as enum ('beginner', 'intermediate', 'advanced', 'pro');

alter table clients add column skill_level skill_level;
