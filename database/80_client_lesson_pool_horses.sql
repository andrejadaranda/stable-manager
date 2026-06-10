-- =============================================================
-- 80_client_lesson_pool_horses.sql
-- Let clients see and request the stable's lesson horses (school
-- horses), not only horses they already own or have ridden.
-- =============================================================

-- 1) Read: a client may read active, lesson-available horses in their stable.
create policy horses_read_lesson_pool_client on horses
  for select
  using (
    stable_id = current_stable_id()
    and current_user_role() = 'client'
    and active = true
    and available_for_lessons = true
  );

-- 2) Insert: widen the lesson-request insert check so a client may request
--    a lesson on a lesson-available stable horse too (was: owned or ridden only).
drop policy if exists lesson_requests_client_insert_own on lesson_requests;
create policy lesson_requests_client_insert_own on lesson_requests
  for insert
  with check (
    current_user_role() = 'client'
    and requester_client_id = current_client_id()
    and (
      horse_id is null
      or exists (
        select 1 from horses h
        where h.id = lesson_requests.horse_id
          and h.stable_id = lesson_requests.stable_id
          and (
            h.owner_client_id = current_client_id()
            or exists (
              select 1 from lessons l
              where l.horse_id = h.id and l.client_id = current_client_id()
            )
            or (h.active and h.available_for_lessons)
          )
      )
    )
  );

notify pgrst, 'reload schema';
