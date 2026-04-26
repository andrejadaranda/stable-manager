-- =============================================================
-- 07_calendar_policies.sql
-- Required for the client-portal calendar.
--
-- Without this, a client can read their lesson rows but joining
-- to horses/profiles returns null — they can't see the horse name
-- or trainer name on their own lessons.
--
-- These two policies expose ONLY the rows that already appear in a
-- lesson the client owns. No broader roster is exposed.
-- Multiple SELECT policies on a table are OR-combined; staff
-- visibility is unaffected.
-- =============================================================

create policy horses_read_via_own_lesson on horses
  for select using (
    stable_id = current_stable_id()
    and exists (
      select 1 from lessons l
      where l.horse_id  = horses.id
        and l.client_id = current_client_id()
    )
  );

create policy profiles_read_via_own_lesson on profiles
  for select using (
    stable_id = current_stable_id()
    and exists (
      select 1 from lessons l
      where l.trainer_id = profiles.id
        and l.client_id  = current_client_id()
    )
  );
