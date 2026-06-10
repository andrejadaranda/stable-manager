-- =============================================================
-- 77_health_kind_add_deworming_other_enum.sql
-- Add 'deworming' and 'other' to the health_record_kind enum so the
-- "Add health record" form can log deworming and free-form records.
-- ADD VALUE must be committed before the new values can be referenced
-- in a CHECK constraint, so the constraint update lives in migration 78.
-- =============================================================
alter type health_record_kind add value if not exists 'deworming';
alter type health_record_kind add value if not exists 'other';
