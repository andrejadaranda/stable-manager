-- =============================================================
-- 57_guest_contributor_tokens.sql
-- Sprint 4 W2 — MULTI-PARTY JOURNAL (the moat play).
--
-- External vets / farriers post into a horse's health log via a
-- signed magic-link without ever creating a Longrein account. Once a
-- farrier is using us for one stable, they pull the next stable in
-- because their workflow lives here. Strategic network-effect lever
-- that none of the rider-individual competitors (Equilab, etc.) can
-- replicate without rebuilding into a SaaS platform.
--
-- Security model:
--   - Token is a 32-byte URL-safe random string (minted client-side
--     via crypto.randomUUID + extra entropy, stored as plain text
--     because tokens themselves are the secret — same model as
--     password-reset emails). Owner can revoke at any time.
--   - Token grants WRITE-ONLY access to ONE horse's health log,
--     scoped to a single record kind (vet / farrier).
--   - SECURITY DEFINER RPC `record_guest_health_event` performs the
--     insert. Authenticated app users can also mint/list/revoke
--     tokens via standard RLS on the table.
--   - Rate limit defended in the RPC: 5 inserts / token / hour.
--
-- Already applied via Supabase MCP. This file is the canonical
-- source-of-truth copy.
-- =============================================================

create type guest_contributor_kind as enum ('vet', 'farrier');

create table if not exists guest_contributor_tokens (
  id              uuid primary key default gen_random_uuid(),
  stable_id       uuid not null references stables(id) on delete cascade,
  horse_id        uuid not null references horses(id) on delete cascade,
  /** High-entropy URL-safe token. The bearer of the token has write
   *  access until revoked or expired. */
  token           text not null unique check (length(token) between 16 and 80),
  kind            guest_contributor_kind not null,
  /** Display name shown on the guest form so the contributor knows
   *  which horse / which stable they're posting to. Also stamped into
   *  horse_health_records.notes as the source attribution. */
  contributor_name text not null check (length(contributor_name) between 1 and 80),
  created_by      uuid not null references profiles(id) on delete cascade,
  expires_at      timestamptz not null default now() + interval '90 days',
  revoked_at      timestamptz,
  last_used_at    timestamptz,
  use_count       int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_guest_tokens_stable_active
  on guest_contributor_tokens (stable_id)
  where revoked_at is null;
create index if not exists idx_guest_tokens_horse
  on guest_contributor_tokens (horse_id);

comment on table guest_contributor_tokens is
  'Magic-link tokens that let external vets/farriers post into a single horse health log without an account. Owner-mintable, owner-revocable. The token IS the secret.';

create or replace function guest_contributor_tokens_enforce_same_stable() returns trigger
language plpgsql as $$
declare s uuid;
begin
  select stable_id into s from horses where id = new.horse_id;
  if s is null or s <> new.stable_id then
    raise exception 'guest_contributor_tokens.horse_id must belong to the same stable';
  end if;
  select stable_id into s from profiles where id = new.created_by;
  if s is null or s <> new.stable_id then
    raise exception 'guest_contributor_tokens.created_by must belong to the same stable';
  end if;
  return new;
end $$;

drop trigger if exists trg_guest_tokens_same_stable on guest_contributor_tokens;
create trigger trg_guest_tokens_same_stable
  before insert or update on guest_contributor_tokens
  for each row execute function guest_contributor_tokens_enforce_same_stable();

alter table guest_contributor_tokens enable row level security;
alter table guest_contributor_tokens force  row level security;

drop policy if exists guest_tokens_rw_staff on guest_contributor_tokens;
create policy guest_tokens_rw_staff on guest_contributor_tokens
  for all
  using (
    stable_id = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  )
  with check (
    stable_id = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  );

grant select, insert, update, delete on guest_contributor_tokens to authenticated;

-- =============================================================
-- SECURITY DEFINER RPC — the guest-side insert.
-- Anonymous (anon role) callable. Token is the entire authentication.
-- =============================================================

create or replace function record_guest_health_event(
  p_token          text,
  p_title          text,
  p_occurred_on    date,
  p_next_due_on    date default null,
  p_notes          text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tok          guest_contributor_tokens%rowtype;
  v_recent_count int;
  v_record_id    uuid;
  v_notes_out    text;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'INVALID_TOKEN';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'INVALID_TITLE';
  end if;
  if p_occurred_on is null then
    raise exception 'INVALID_DATE';
  end if;
  if length(p_title) > 200 then
    raise exception 'TITLE_TOO_LONG';
  end if;

  select * into v_tok from guest_contributor_tokens where token = p_token;
  if not found then
    raise exception 'TOKEN_NOT_FOUND';
  end if;
  if v_tok.revoked_at is not null then
    raise exception 'TOKEN_REVOKED';
  end if;
  if v_tok.expires_at <= now() then
    raise exception 'TOKEN_EXPIRED';
  end if;

  -- Rate limit: max 5 inserts per token in the last hour.
  select count(*) into v_recent_count
    from horse_health_records r
   where r.horse_id = v_tok.horse_id
     and r.kind = v_tok.kind::text::health_record_kind
     and r.created_at > now() - interval '1 hour'
     and r.notes like ('Guest contributor: ' || v_tok.contributor_name || '%');
  if v_recent_count >= 5 then
    raise exception 'RATE_LIMIT';
  end if;

  v_notes_out := 'Guest contributor: ' || v_tok.contributor_name;
  if p_notes is not null and length(trim(p_notes)) > 0 then
    v_notes_out := v_notes_out || E'\n\n' || trim(p_notes);
  end if;

  insert into horse_health_records (
    stable_id, horse_id, kind, occurred_on, next_due_on, title, notes, created_by
  )
  values (
    v_tok.stable_id, v_tok.horse_id, v_tok.kind::text::health_record_kind,
    p_occurred_on, p_next_due_on, p_title, v_notes_out, null
  )
  returning id into v_record_id;

  update guest_contributor_tokens
     set last_used_at = now(),
         use_count    = use_count + 1
   where id = v_tok.id;

  return jsonb_build_object(
    'ok',         true,
    'record_id',  v_record_id,
    'horse_id',   v_tok.horse_id,
    'kind',       v_tok.kind
  );
end $$;

revoke all    on function record_guest_health_event(text, text, date, date, text) from public;
grant execute on function record_guest_health_event(text, text, date, date, text) to anon, authenticated;

create or replace function resolve_guest_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tok       guest_contributor_tokens%rowtype;
  v_horse_nm  text;
  v_stable_nm text;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'INVALID_TOKEN';
  end if;
  select * into v_tok from guest_contributor_tokens where token = p_token;
  if not found then
    raise exception 'TOKEN_NOT_FOUND';
  end if;
  if v_tok.revoked_at is not null then
    raise exception 'TOKEN_REVOKED';
  end if;
  if v_tok.expires_at <= now() then
    raise exception 'TOKEN_EXPIRED';
  end if;

  select name into v_horse_nm  from horses  where id = v_tok.horse_id;
  select name into v_stable_nm from stables where id = v_tok.stable_id;

  return jsonb_build_object(
    'ok',               true,
    'horse_name',       v_horse_nm,
    'stable_name',      v_stable_nm,
    'kind',             v_tok.kind,
    'contributor_name', v_tok.contributor_name,
    'expires_at',       v_tok.expires_at
  );
end $$;

revoke all    on function resolve_guest_token(text) from public;
grant execute on function resolve_guest_token(text) to anon, authenticated;
