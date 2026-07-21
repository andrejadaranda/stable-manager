-- 106_group_participant_payments.sql
-- Per-participant payments for group lessons: each rider (often a different
-- family) is marked paid + method individually, instead of one bill for the
-- whole group. A participant payment carries lesson_participant_id (NOT
-- lesson_id — the parent lesson has a single payer, so linking lesson_id for a
-- different family member would trip the same-stable/same-client trigger).
-- billable_items is rebuilt so a group lesson splits into one row per
-- confirmed participant. Applied to live DB dluxzjphpokzkrwmmibe 2026-07-20.

alter table lesson_participants add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists lesson_participants_id_key on lesson_participants(id);

alter table payments add column if not exists lesson_participant_id uuid
  references lesson_participants(id) on delete set null;
create index if not exists payments_lesson_participant_idx on payments(lesson_participant_id);

-- payments_enforce_same_stable() gains a lesson_participant_id branch (validates
-- the participant's lesson is in-stable and the payer matches the participant).
-- Full function body applied via MCP; see migration history.

-- billable_items rebuilt: individual lessons stay one parent row; group lessons
-- (lesson_type='group') split into one row per confirmed participant, paid_amount
-- summed by lesson_participant_id. See migration history for the full view DDL.
