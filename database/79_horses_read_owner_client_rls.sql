-- =============================================================
-- 79_horses_read_owner_client_rls.sql
-- BUG FIX: a client who OWNS a horse (horses.owner_client_id = their
-- client id) but rides no lessons on it could not read the horse row —
-- the only client read path was horses_read_via_own_lesson. So the
-- client "My horses" owner section, the my-horses detail page, and the
-- Outstanding card were all empty for horse-owner clients. Add the
-- missing owner-client read policy.
-- =============================================================
create policy horses_read_owner_client on horses
  for select
  using (
    stable_id = current_stable_id()
    and current_user_role() = 'client'
    and owner_client_id is not null
    and owner_client_id = current_client_id()
  );

notify pgrst, 'reload schema';
