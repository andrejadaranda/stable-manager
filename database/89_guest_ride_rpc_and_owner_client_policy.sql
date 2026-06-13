-- =============================================================
-- 89_guest_ride_rpc_and_owner_client_policy.sql
-- Owner-client can mint/list/revoke 'rider' tokens for owned horses, and a
-- SECURITY DEFINER RPC lets a guest rider log a ride on the scoped horse.
-- Mirrors the hardened record_guest_health_event model (token = secret,
-- 5/hour rate limit, owner-revocable). trainer_id (NOT NULL on sessions) is
-- set to the token creator (the owner who enabled the link); the actual
-- rider is stored in sessions.rider_name_freeform.
-- =============================================================
create policy guest_tokens_rw_owner_client on guest_contributor_tokens
  for all
  using (
    current_user_role() = 'client'
    and kind = 'rider'
    and exists (
      select 1 from horses h
      where h.id = guest_contributor_tokens.horse_id
        and h.owner_client_id = current_client_id()
    )
  )
  with check (
    current_user_role() = 'client'
    and kind = 'rider'
    and stable_id = current_stable_id()
    and exists (
      select 1 from horses h
      where h.id = guest_contributor_tokens.horse_id
        and h.owner_client_id = current_client_id()
    )
  );

create or replace function record_guest_ride(
  p_token       text,
  p_started_at  timestamptz,
  p_duration    int,
  p_type        text default 'flat',
  p_notes       text default null,
  p_rating      int  default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tok        guest_contributor_tokens%rowtype;
  v_recent     int;
  v_session_id uuid;
  v_notes_out  text;
  v_type       session_type;
begin
  if p_token is null or length(p_token) < 16 then raise exception 'INVALID_TOKEN'; end if;
  if p_started_at is null then raise exception 'INVALID_DATE'; end if;
  if p_duration is null or p_duration < 1 or p_duration > 600 then raise exception 'INVALID_DURATION'; end if;

  select * into v_tok from guest_contributor_tokens where token = p_token;
  if not found then raise exception 'TOKEN_NOT_FOUND'; end if;
  if v_tok.kind <> 'rider' then raise exception 'WRONG_TOKEN_KIND'; end if;
  if v_tok.revoked_at is not null then raise exception 'TOKEN_REVOKED'; end if;
  if v_tok.expires_at <= now() then raise exception 'TOKEN_EXPIRED'; end if;

  select count(*) into v_recent
    from sessions s
   where s.horse_id = v_tok.horse_id
     and s.rider_name_freeform = v_tok.contributor_name
     and s.created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'RATE_LIMIT'; end if;

  begin
    v_type := p_type::session_type;
  exception when others then
    v_type := 'flat';
  end;

  v_notes_out := 'Guest rider: ' || v_tok.contributor_name;
  if p_notes is not null and length(trim(p_notes)) > 0 then
    v_notes_out := v_notes_out || E'\n\n' || trim(p_notes);
  end if;

  insert into sessions (
    stable_id, horse_id, rider_name_freeform, trainer_id,
    started_at, duration_minutes, type, notes, rating
  )
  values (
    v_tok.stable_id, v_tok.horse_id, v_tok.contributor_name, v_tok.created_by,
    p_started_at, p_duration, v_type, v_notes_out,
    case when p_rating between 1 and 5 then p_rating else null end
  )
  returning id into v_session_id;

  update guest_contributor_tokens
     set last_used_at = now(), use_count = use_count + 1
   where id = v_tok.id;

  return jsonb_build_object('ok', true, 'session_id', v_session_id, 'horse_id', v_tok.horse_id);
end $$;

revoke all    on function record_guest_ride(text, timestamptz, int, text, text, int) from public;
grant execute on function record_guest_ride(text, timestamptz, int, text, text, int) to anon, authenticated;
