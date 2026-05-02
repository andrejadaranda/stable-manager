-- =============================================================
-- 30_emergency_contacts.sql
--
-- Backup / emergency contact info on clients AND horses.
--
-- Why both:
--   * clients: rider falls off / has a medical event during a lesson.
--     Trainer needs to call someone. Stored on the client (rider)
--     because that's who's at risk.
--   * horses: the horse's owner is unreachable (holiday, hospital).
--     We need to call a next-of-kin / trusted vet / neighbour to make
--     a decision (vet visit, transport, end-of-life). Lives on the
--     HORSE row even though it's typically a person related to the
--     owner — that way it survives ownership changes.
--
-- All columns optional. Privacy: visible to owner + employee only via
-- existing RLS on clients / horses tables. The client portal can
-- expose their own row for self-edit later (out of scope here).
-- =============================================================

alter table clients
  add column emergency_contact_name      text,
  add column emergency_contact_phone     text,
  add column emergency_contact_relation  text;

alter table horses
  add column backup_contact_name      text,
  add column backup_contact_phone     text,
  add column backup_contact_relation  text;

comment on column clients.emergency_contact_name is
  'Name of the rider''s emergency contact (e.g. spouse, parent). Optional.';
comment on column clients.emergency_contact_phone is
  'Phone of the rider''s emergency contact. Optional.';
comment on column clients.emergency_contact_relation is
  'Relationship of the rider''s emergency contact (e.g. spouse, parent, friend). Free text.';

comment on column horses.backup_contact_name is
  'Name of the backup contact when the horse owner cannot be reached.';
comment on column horses.backup_contact_phone is
  'Phone of the backup contact when the horse owner cannot be reached.';
comment on column horses.backup_contact_relation is
  'Relationship of the backup contact (e.g. vet, neighbour, partner). Free text.';

-- =============================================================
-- DONE. Run this in the Supabase SQL Editor (or supabase db push).
-- =============================================================
