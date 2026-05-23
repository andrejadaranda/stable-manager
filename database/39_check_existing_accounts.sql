-- =============================================================
-- 39_check_existing_accounts.sql
--
-- SECURITY DEFINER RPC that lets an owner check, in bulk, whether a
-- list of emails/phones already belongs to a Longrein account in ANY
-- stable. Drives the client-list UI: hide the "Invite to app" button
-- for clients whose contact details already point at an existing
-- account elsewhere — otherwise the invite would 500 on createUser
-- ("email already registered") or surprise-link cross-stable.
--
-- Why SECURITY DEFINER (and not plain RLS):
--   * Emails live in auth.users (admin schema), not in public.profiles.
--     Regular RLS-scoped reads can't see them across stables.
--   * Phones live in profiles, which IS RLS-scoped per stable — same
--     problem in reverse: an owner cannot see another stable's profiles.
--   * This RPC returns ONLY the matched contact strings, never user IDs
--     or other PII. It's effectively a "does this exist?" probe — safe
--     to expose to authenticated owners.
--
-- Grant model: authenticated only (NOT anon). The accept-invite anon
-- flow has its own narrower check inside accept_client_invitation.
-- =============================================================

create or replace function check_existing_longrein_accounts(
  p_emails text[],
  p_phones text[]
)
returns table (
  matched_email text,
  matched_phone text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
begin
  -- Defence in depth — only callers who are owners may probe.
  v_caller_role := current_user_role();
  if v_caller_role is null or v_caller_role <> 'owner' then
    raise exception 'only owners can check account existence';
  end if;

  -- Match emails against auth.users. Lowercase comparison both sides
  -- because Supabase stores email lowercased but the caller may pass
  -- mixed case from clients.email (we don't enforce lower at insert).
  return query
    select lower(u.email) as matched_email, null::text as matched_phone
      from auth.users u
     where p_emails is not null
       and array_length(p_emails, 1) > 0
       and lower(u.email) = any(
         coalesce(
           array(select lower(unnest(p_emails))),
           array[]::text[]
         )
       );

  -- Match phones against profiles.phone. Phones aren't normalised on
  -- insert (no E.164 enforcement) so we compare as-is + whitespace-stripped.
  return query
    select null::text as matched_email,
           p.phone     as matched_phone
      from profiles p
     where p_phones is not null
       and array_length(p_phones, 1) > 0
       and p.phone is not null
       and (
         p.phone = any(p_phones)
         or replace(p.phone, ' ', '') = any(
              coalesce(
                array(select replace(unnest(p_phones), ' ', '')),
                array[]::text[]
              )
            )
       );
end $$;

revoke all on function check_existing_longrein_accounts(text[], text[]) from public;
grant execute on function check_existing_longrein_accounts(text[], text[]) to authenticated;

-- =============================================================
-- accept_client_invitation v2 — same as 38 but takes an optional
-- p_phone arg and writes it to both profiles.phone (always) and
-- clients.phone (only when NULL, so we don't overwrite a value the
-- owner already typed). Forward-compatible: callers that pass NULL
-- get the original behaviour.
-- =============================================================

create or replace function accept_client_invitation(
  p_token        text,
  p_auth_user_id uuid,
  p_full_name    text,
  p_phone        text default null
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

  if exists (select 1 from profiles where auth_user_id = p_auth_user_id) then
    update client_invitations set used_at = null where token = p_token;
    raise exception 'auth user already belongs to a stable';
  end if;

  insert into profiles(auth_user_id, stable_id, full_name, role, phone)
    values (p_auth_user_id, v_stable_id, p_full_name, 'client',
            nullif(trim(coalesce(p_phone, '')), ''))
    returning id into v_profile_id;

  update clients
     set profile_id = v_profile_id,
         -- Only fill phone when the owner left it blank — never
         -- overwrite a value the owner already typed into the row.
         phone = coalesce(
                   nullif(phone, ''),
                   nullif(trim(coalesce(p_phone, '')), '')
                 )
   where id = v_client_id
     and profile_id is null;

  return v_profile_id;
end $$;

revoke all on function accept_client_invitation(text, uuid, text, text) from public;
grant execute on function accept_client_invitation(text, uuid, text, text) to anon, authenticated;

-- =============================================================
-- DONE. Run in Supabase SQL Editor.
-- Idempotent — re-runnable.
-- =============================================================
