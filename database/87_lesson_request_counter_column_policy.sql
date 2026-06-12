-- =============================================================
-- 87_lesson_request_counter_column_policy.sql
-- proposed_start carries the stable's counter-offer time; the client then
-- accepts (request returns to pending at the agreed time for the owner to
-- finalise with horse/trainer) or declines. Widen the client update policy
-- so they can respond to a counter-offer (status 'countered').
-- =============================================================
alter table lesson_requests
  add column if not exists proposed_start timestamptz;

drop policy if exists lesson_requests_client_update_pending on lesson_requests;
create policy lesson_requests_client_update_pending on lesson_requests
  for update
  using (
    current_user_role() = 'client'
    and requester_client_id = current_client_id()
    and status in ('pending', 'countered')
  )
  with check (
    current_user_role() = 'client'
    and requester_client_id = current_client_id()
    and status in ('pending', 'countered', 'declined')
  );
