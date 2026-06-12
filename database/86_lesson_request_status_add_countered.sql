-- =============================================================
-- 86_lesson_request_status_add_countered.sql
-- Negotiation: the stable can propose a different time instead of a flat
-- decline. Add the 'countered' enum value (must be committed before it can
-- be referenced); the column + policies land in migration 87.
-- =============================================================
alter type lesson_request_status add value if not exists 'countered';
