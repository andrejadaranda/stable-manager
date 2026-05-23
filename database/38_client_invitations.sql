-- =============================================================
-- 38_client_invitations.sql
--
-- Replaces the "owner sees the client's password and shares it
-- manually" invite UX with a link-based flow. Owner clicks Invite,
-- we generate a random token, send the client an email with a link
-- to /invite/<token>, and the client picks their own password there.
--
-- Why a new table (instead of stuffing this into clients or auth):
--   * The client.row may not exist as an auth.user yet — invitations
--     live in a side table so we can track pending state cleanly.
--   * Auth.users metadata is opaque + hard to audit. A dedicated
--     table gives us proper RLS, expiry, used-at, and per-row notes.
--
-- Why opaque random tokens (not short codes):
--   * Anyone with the token can claim the invite — entropy matters.
--     We use 32 random bytes encoded as base64url ≈ 43 chars.
--   * Owners never type tokens, the client clicks a link, so length
--     is fine.
--
-- Lifecycle:
--   pending  → emitted, link not clicked yet           (default)
--   accepted → client clicked + set password           (used_at set)
--   expired  → past expires_at                         (computed)
--   revoked  → owner cancelled it                      (revoked_at set)
--
-- RLS:
--   * select : owner of the same stable
--   * insert : owner only
--   * update : owner (revoke) + the consume RPC (used_at)
--   * delete : owner only
-- The actual /invite/[token] accept path doesn't query the table
-- via RLS — it goes through a SECURITY DEFINER RPC that bypasses
-- RLS to look up by token + mark used.
-- =============================================================

create table if not exists client_invitations (
  id           uuid primary key default gen_random_uuid(),
  stable_id    uuid not null references stables(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  email        text not null check (length(trim(email)) > 0 and length(email) <= 320),
  /** Random opaque token — never indexed for prefix search,
   *  always equality lookups. */
  token        text not null unique,
  created_by   uuid not null references profiles(id) on delete cascade,
  /** Invitation TTL. Default 14 days from creation — long enough
   *  for vacation / sporadic checkers, short enough that abandoned
   *  links don't sit forever. */
  expires_at   timestamptz not null default (now() + interval '14 days'),
  /** Set when the client accepts. NULL = still pending. */
  used_at      timestamptz,
  /** Set when the owner revokes a pending invite. */
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists client_invitations_stable_status
  on client_invitations (stable_id, used_at, revoked_at);
create index if not exists client_invitations_client
  on client_invitations (client_id);

comment on table client_invitations is
  'Pending client portal invitations. One row per emit; reissue creates a new row.';

-- ---------------- SAME-STABLE ENFORCEMENT ----------------
create or replace function client_invitations_enforce_same_stable()
returns trigger language plpgsql as $$
declare s uuid;
begin
  select stable_id into s from clients where id = new.client_id;
  if s is null or s <> new.stable_id then
    raise exception 'client_invitations.client_id must belong to the same stable';
  end if;
  select stable_id into s from profiles where id = new.created_by;
  if s is null or s <> new.stable_id then
    raise exception 'client_invitations.created_by must belong to the same stable';
  end if;
  return new;
end $$;

drop trigger if exists trg_client_invitations_same_stable on client_invitations;
create trigger trg_client_invitations_same_stable
  before insert or update on client_invitations
  for each row execute function client_invitations_enforce_same_stable();

-- ---------------- RLS ----------------
alter table client_invitations enable row level security;
alter table client_invitations force  row level security;

drop policy if exists client_invitations_read   on client_invitations;
drop policy if exists client_invitations_insert on client_invitations;
drop policy if exists client_invitations_update on client_invitations;
drop policy if exists client_invitations_delete on client_invitations;

create policy client_invitations_read on client_invitations
  for select
  using (stable_id = current_stable_id()
         and exists (
           select 1 from profiles
            where id = current_user_id() and role = 'owner'
         ));

create policy client_invitations_insert on client_invitations
  for insert
  with check (stable_id = current_stable_id()
              and created_by = current_user_id()
              and exists (
                select 1 from profiles
                 where id = current_user_id() and role = 'owner'
              ));

create policy client_invitations_update on client_invitations
  for update
  using (stable_id = current_stable_id()
         and exists (
           select 1 from profiles
            where id = current_user_id() and role = 'owner'
         ))
  with check (stable_id = current_stable_id());

create policy client_invitations_delete on client_invitations
  for delete
  using (stable_id = current_stable_id()
         and exists (
           select 1 from profiles
            where id = current_user_id() and role = 'owner'
         ));

-- ---------------- LOOKUP RPC (SECURITY DEFINER) ----------------
-- The accept page hits this with the raw token in the URL; the
-- client is not yet authenticated against the stable, so RLS would
-- block them. SECURITY DEFINER lets us safely look up by token AND
-- enforce the not-used / not-revoked / not-expired checks server-side.
create or replace function lookup_client_invitation(p_token text)
returns table (
  id          uuid,
  stable_id   uuid,
  stable_name text,
  client_id   uuid,
  client_name text,
  email       text,
  expires_at  timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      ci.id,
      ci.stable_id,
      s.name  as stable_name,
      ci.client_id,
      c.full_name as client_name,
      ci.email,
      ci.expires_at
    from client_invitations ci
    join stables s on s.id = ci.stable_id
    join clients c on c.id = ci.client_id
   where ci.token      = p_token
     and ci.used_at    is null
     and ci.revoked_at is null
     and ci.expires_at > now()
   limit 1;
end $$;

revoke all on function lookup_client_invitation(text) from public;
grant execute on function lookup_client_invitation(text) to anon, authenticated;

-- ---------------- ACCEPT RPC (SECURITY DEFINER) ----------------
-- Single atomic call invoked by the accept action AFTER the auth.user
-- has been created with the chosen password. Does the rest in one
-- transaction:
--   1. Re-validates the invite (race-proof: locks the row).
--   2. Inserts profiles(role=client) with stable_id from the invite.
--      Cannot reuse attach_user_to_stable() because that RPC requires
--      the CALLER to be the stable's owner; the accept flow is
--      anonymous (or signed in as a different user).
--   3. Links clients.profile_id to the new profiles.id.
--   4. Marks invite used_at = now().
-- Returns the newly created profile id on success, NULL on failure
-- (invite already used, expired, revoked, or auth user already has a
-- profile — protects against accidental cross-stable account moves).
create or replace function accept_client_invitation(
  p_token        text,
  p_auth_user_id uuid,
  p_full_name    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stable_id  uuid;
  v_client_id  uuid;
  v_profile_id uuid;
begin
  -- Step 1 — validate + lock the invite row.
  update client_invitations
     set used_at = now()
   where token      = p_token
     and used_at    is null
     and revoked_at is null
     and expires_at > now()
   returning stable_id, client_id into v_stable_id, v_client_id;

  if v_stable_id is null then
    return null;
  end if;

  -- Step 2 — sanity check: this auth user must not already have a
  -- profile (cross-stable account moves are deliberately blocked).
  if exists (select 1 from profiles where auth_user_id = p_auth_user_id) then
    -- Roll back the used_at flip so the owner can re-investigate.
    update client_invitations set used_at = null where token = p_token;
    raise exception 'auth user already belongs to a stable';
  end if;

  -- Step 3 — create the client profile.
  insert into profiles(auth_user_id, stable_id, full_name, role)
    values (p_auth_user_id, v_stable_id, p_full_name, 'client')
    returning id into v_profile_id;

  -- Step 4 — link the existing clients row. Guard the join so we
  -- never overwrite a pre-existing portal link.
  update clients
     set profile_id = v_profile_id
   where id = v_client_id
     and profile_id is null;

  return v_profile_id;
end $$;

revoke all on function accept_client_invitation(text, uuid, text) from public;
grant execute on function accept_client_invitation(text, uuid, text) to anon, authenticated;

-- =============================================================
-- DONE. Run in Supabase SQL Editor.
-- =============================================================
