-- =============================================================
-- 97_account_deletion_fk_deep.sql  (applied via Supabase MCP 2026-07-08)
-- Deeper cascade blockers found by a safe rolled-back DELETE test of a whole
-- stable. clients/horses-referencing records: RESTRICT -> NO ACTION (still
-- blocks single-client/horse delete with history, but the whole-stable cascade
-- completes because those rows are deleted via their own stable_id in the same
-- statement). lesson_participants is a pure junction with NO stable_id of its
-- own -> CASCADE so it dies with its horse / client / lesson (deterministic).
-- =============================================================
alter table client_charges drop constraint client_charges_client_id_fkey;
alter table client_charges add constraint client_charges_client_id_fkey foreign key (client_id) references clients(id) on delete no action;
alter table invoices drop constraint invoices_client_id_fkey;
alter table invoices add constraint invoices_client_id_fkey foreign key (client_id) references clients(id) on delete no action;
alter table lesson_packages drop constraint lesson_packages_client_id_fkey;
alter table lesson_packages add constraint lesson_packages_client_id_fkey foreign key (client_id) references clients(id) on delete no action;
alter table lessons drop constraint lessons_client_id_fkey;
alter table lessons add constraint lessons_client_id_fkey foreign key (client_id) references clients(id) on delete no action;
alter table payments drop constraint payments_client_id_fkey;
alter table payments add constraint payments_client_id_fkey foreign key (client_id) references clients(id) on delete no action;
alter table horse_boarding_charges drop constraint horse_boarding_charges_owner_client_id_fkey;
alter table horse_boarding_charges add constraint horse_boarding_charges_owner_client_id_fkey foreign key (owner_client_id) references clients(id) on delete no action;

alter table horse_boarding_charges drop constraint horse_boarding_charges_horse_id_fkey;
alter table horse_boarding_charges add constraint horse_boarding_charges_horse_id_fkey foreign key (horse_id) references horses(id) on delete no action;
alter table lessons drop constraint lessons_horse_id_fkey;
alter table lessons add constraint lessons_horse_id_fkey foreign key (horse_id) references horses(id) on delete no action;

alter table lesson_participants drop constraint lesson_participants_horse_id_fkey;
alter table lesson_participants add constraint lesson_participants_horse_id_fkey foreign key (horse_id) references horses(id) on delete cascade;
alter table lesson_participants drop constraint lesson_participants_client_id_fkey;
alter table lesson_participants add constraint lesson_participants_client_id_fkey foreign key (client_id) references clients(id) on delete cascade;
