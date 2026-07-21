-- 108_proforma_numbering_and_participant_lines.sql
-- Proforma document numbering (separate from the fiscal invoice sequence) +
-- invoice line link to a group participant so each family's line dedups.
-- billable_items rebuilt so a group-participant row's invoiced flag counts via
-- invoice_items.lesson_participant_id (real faktūra only). Applied to live DB
-- dluxzjphpokzkrwmmibe 2026-07-20.

alter table stables add column if not exists next_proforma_seq integer not null default 1;
alter table invoice_items add column if not exists lesson_participant_id uuid
  references lesson_participants(id) on delete set null;

-- billable_items rebuilt (full DDL in migration history): group-participant
-- rows now compute invoiced via invoice_items.lesson_participant_id.
