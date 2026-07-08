-- =============================================================
-- 96_account_deletion_fk.sql  (applied via Supabase MCP 2026-07-08)
-- App Store 5.1.1(v): owner account deletion = DELETE stables -> cascade.
-- profiles-referencing FKs were RESTRICT and could abort the cascade
-- (RESTRICT is checked mid-cascade, not deferred). Fix: SET NULL where the
-- column is nullable (keep the record, drop the person link); NO ACTION
-- where NOT NULL (the stable-cascade deletes those child rows in the same
-- statement, so the end-of-statement check passes).
-- =============================================================
alter table lessons drop constraint lessons_trainer_id_fkey;
alter table lessons add constraint lessons_trainer_id_fkey
  foreign key (trainer_id) references profiles(id) on delete set null;

alter table sessions drop constraint sessions_trainer_id_fkey;
alter table sessions add constraint sessions_trainer_id_fkey
  foreign key (trainer_id) references profiles(id) on delete no action;

alter table chat_messages drop constraint chat_messages_sender_profile_id_fkey;
alter table chat_messages add constraint chat_messages_sender_profile_id_fkey
  foreign key (sender_profile_id) references profiles(id) on delete no action;

alter table expenses drop constraint expenses_created_by_fkey;
alter table expenses add constraint expenses_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;
