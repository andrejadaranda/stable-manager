-- =============================================================
-- 58_live_session_shares.sql
-- Sprint 4 W3 — LIVE SAFETY TRACKING ("Beacon").
-- Equilab gap #2.
--
-- Rider mints a public read-only share token before/during a live
-- ride. Emergency contact opens /live/<token> in any browser — no
-- account — and sees live map + last-known position + speed + how
-- long since the last GPS ping.
--
-- Auto-expires when the parent session finalizes / abandons, so the
-- link is short-lived by design. Owner can also revoke manually.
--
-- Security model: token is the entire authentication. SECURITY
-- DEFINER RPC returns only safe public-readable fields (no rider PII
-- beyond their first name and the horse name).
--
-- Already applied via Supabase MCP. This file is the canonical
-- source-of-truth copy.
-- =============================================================

create table if not exists live_session_shares (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null unique references sessions(id) on delete cascade,
  stable_id     uuid not null references stables(id) on delete cascade,
  token         text not null unique check (length(token) between 16 and 80),
  /** Beacon link auto-expires X minutes after session finalize. Default 4h
   *  is plenty for a long hack including unsaddling/cool-down. */
  expires_at    timestamptz not null default now() + interval '4 hours',
  /** Optional override — owner can revoke immediately. */
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  view_count    int not null default 0,
  last_viewed_at timestamptz
);

create index if not exists idx_live_shares_token on live_session_shares (token) where revoked_at is null;
create index if not exists idx_live_shares_session on live_session_shares (session_id);

create or replace function live_session_shares_enforce_same_stable() returns trigger
language plpgsql as $$
declare s uuid;
begin
  select stable_id into s from sessions where id = new.session_id;
  if s is null or s <> new.stable_id then
    raise exception 'live_session_shares.session_id must belong to the same stable';
  end if;
  return new;
end $$;

drop trigger if exists trg_live_shares_same_stable on live_session_shares;
create trigger trg_live_shares_same_stable
  before insert or update on live_session_shares
  for each row execute function live_session_shares_enforce_same_stable();

alter table live_session_shares enable row level security;
alter table live_session_shares force  row level security;

drop policy if exists live_shares_rw_staff on live_session_shares;
create policy live_shares_rw_staff on live_session_shares
  for all
  using (
    stable_id = current_stable_id()
    and exists (
      select 1 from sessions s
      where s.id = live_session_shares.session_id
        and (
          current_user_role() = 'owner'
          or (current_user_role() = 'employee' and s.trainer_id = auth.uid())
          or (current_user_role() = 'client'   and s.rider_client_id = current_client_id())
        )
    )
  )
  with check (
    stable_id = current_stable_id()
  );

grant select, insert, update, delete on live_session_shares to authenticated;

-- Anonymous resolver: minimal safe payload + up to 500 most recent points.
create or replace function resolve_live_share(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_share     live_session_shares%rowtype;
  v_session   sessions%rowtype;
  v_horse_nm  text;
  v_stable_nm text;
  v_points    jsonb;
begin
  if p_token is null or length(p_token) < 16 then raise exception 'INVALID_TOKEN'; end if;
  select * into v_share from live_session_shares where token = p_token;
  if not found then raise exception 'TOKEN_NOT_FOUND'; end if;
  if v_share.revoked_at is not null then raise exception 'TOKEN_REVOKED'; end if;
  if v_share.expires_at <= now() then raise exception 'TOKEN_EXPIRED'; end if;

  select * into v_session from sessions where id = v_share.session_id;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  select name into v_horse_nm  from horses  where id = v_session.horse_id;
  select name into v_stable_nm from stables where id = v_session.stable_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'lat', t.lat, 'lng', t.lng, 'spd', t.speed_mps, 'at', t.recorded_at
  ) order by t.recorded_at), '[]'::jsonb) into v_points
    from (
      select lat, lng, speed_mps, recorded_at
        from session_tracks
       where session_id = v_share.session_id
       order by recorded_at desc
       limit 500
    ) t;

  update live_session_shares
     set view_count = view_count + 1, last_viewed_at = now()
   where id = v_share.id;

  return jsonb_build_object(
    'ok',          true,
    'session_id',  v_share.session_id,
    'horse_name',  v_horse_nm,
    'stable_name', v_stable_nm,
    'status',      v_session.status,
    'started_at',  v_session.started_at,
    'finished_at', v_session.finished_at,
    'expires_at',  v_share.expires_at,
    'points',      v_points
  );
end $$;

revoke all    on function resolve_live_share(text) from public;
grant execute on function resolve_live_share(text) to anon, authenticated;

-- Incremental poll — only points since `p_since`.
create or replace function poll_live_share(p_token text, p_since timestamptz)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_share   live_session_shares%rowtype;
  v_session sessions%rowtype;
  v_points  jsonb;
begin
  if p_token is null or length(p_token) < 16 then raise exception 'INVALID_TOKEN'; end if;
  select * into v_share from live_session_shares where token = p_token;
  if not found then raise exception 'TOKEN_NOT_FOUND'; end if;
  if v_share.revoked_at is not null then raise exception 'TOKEN_REVOKED'; end if;
  if v_share.expires_at <= now() then raise exception 'TOKEN_EXPIRED'; end if;

  select * into v_session from sessions where id = v_share.session_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'lat', t.lat, 'lng', t.lng, 'spd', t.speed_mps, 'at', t.recorded_at
  ) order by t.recorded_at), '[]'::jsonb) into v_points
    from session_tracks t
   where t.session_id = v_share.session_id
     and (p_since is null or t.recorded_at > p_since)
   order by t.recorded_at
   limit 200;

  return jsonb_build_object(
    'ok',          true,
    'status',      v_session.status,
    'finished_at', v_session.finished_at,
    'points',      v_points
  );
end $$;

revoke all    on function poll_live_share(text, timestamptz) from public;
grant execute on function poll_live_share(text, timestamptz) to anon, authenticated;
