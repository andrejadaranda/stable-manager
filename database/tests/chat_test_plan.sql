-- =============================================================
-- chat_test_plan.sql
-- Manual security tests for the chat module (migrations 09–11).
--
-- Pre-reqs:
--   * 01–08 schema applied
--   * 00_seed.sql executed (gives us Alice/Eve/Charlie/Bob/Beth)
--   * 09_chat_schema.sql + 10_chat_policies.sql + 11_chat_functions.sql applied
--
-- Each test block uses begin/rollback (or notice-based pass/fail
-- inside a DO block) so seed state is preserved.
--
-- One-time setup at TEST 0 adds a SECOND client profile in
-- Stable Alpha so we can test the client↔client deny pair.
--
-- Useful UUIDs (from 00_seed.sql):
--   alice   = a0000000-0000-0000-0000-000000000001  (owner A)
--   eve     = a0000000-0000-0000-0000-000000000002  (employee A)
--   charlie = a0000000-0000-0000-0000-000000000003  (client A)
--   diana   = a0000000-0000-0000-0000-000000000004  (client A, added by TEST 0)
--   bob     = b0000000-0000-0000-0000-000000000001  (owner B)
--   beth    = b0000000-0000-0000-0000-000000000002  (client B)
-- =============================================================


-- =============================================================
-- TEST 0 — One-time setup (commit). Adds Diana as a SECOND client
-- profile in Stable Alpha so client↔client deny can be tested.
-- Idempotent: re-running is a no-op.
-- =============================================================
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000004',
   'authenticated','authenticated','client-a2@test.local',
   crypt('test', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email"}','{}', false, '', '', '', '')
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from profiles where auth_user_id = 'a0000000-0000-0000-0000-000000000004'
  ) then
    -- Impersonate Alice (owner of Alpha) to call attach_user_to_stable.
    perform set_config('request.jwt.claims',
      json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text,
      true);
    set local role authenticated;
    perform attach_user_to_stable('a0000000-0000-0000-0000-000000000004', 'Diana ClientProfile', 'client');
  end if;
end $$;


-- =============================================================
-- TEST 1 — Migration installed cleanly.
-- Expected: tables=3, functions=3, force_rls=3.
-- =============================================================
select
  (select count(*) from information_schema.tables
     where table_schema='public'
       and table_name in ('chat_threads','chat_participants','chat_messages')) as tables_present,        -- expect 3
  (select count(*) from pg_proc
     where proname in ('chat_visible_thread_ids','chat_can_dm','start_direct_thread','mark_thread_read'))
     as functions_present,                                                                                -- expect 4
  (select count(*) from pg_class
     where relname in ('chat_threads','chat_participants','chat_messages')
       and relrowsecurity and relforcerowsecurity) as tables_with_force_rls;                              -- expect 3


-- =============================================================
-- TEST 2 — Every stable has exactly one stable_general thread.
-- Run as postgres (BYPASSRLS).
-- Expected: count = number of stables, distinct stable_ids = same.
-- =============================================================
select
  (select count(*) from chat_threads where type = 'stable_general')         as general_threads_total,
  (select count(*) from stables)                                            as stables_total,
  (select count(distinct stable_id) from chat_threads where type='stable_general') as distinct_stables_with_general;


-- =============================================================
-- TEST 3 — Cross-stable thread leak blocked.
-- Run as Alice. Expected: she sees only Alpha's general (1 row),
-- never Bravo's.
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

  select count(*) as alice_visible_threads from chat_threads;                          -- expect 1
  select count(*) as alice_sees_bravo_general
    from chat_threads t
    join stables s on s.id = t.stable_id
   where s.slug = 'stable-bravo';                                                       -- expect 0
rollback;


-- =============================================================
-- TEST 4 — All Alpha members see Alpha's general.
-- Run successively as Alice, Eve, Charlie. Each should see exactly 1 thread.
-- And Bob (Bravo owner) sees only Bravo's general (also 1).
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);
  select 'eve' as who, count(*) from chat_threads;                                      -- expect 1
rollback;

begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  select 'charlie' as who, count(*) from chat_threads;                                  -- expect 1
rollback;

begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','b0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select 'bob' as who, count(*) from chat_threads;                                      -- expect 1
rollback;


-- =============================================================
-- TEST 5 — Any stable member can post to general; cross-stable
-- members cannot read it.
--   * Charlie (client A) posts a message to Alpha's general.
--   * Alice (owner A) reads it    -> visible
--   * Eve (employee A) reads it   -> visible
--   * Bob (owner B) reads it      -> NOT visible
-- =============================================================
-- Charlie posts.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);

  insert into chat_messages(stable_id, thread_id, sender_profile_id, body)
  select t.stable_id, t.id, current_user_id(), 'hello from Charlie (TEST 5)'
    from chat_threads t
    join stables s on s.id = t.stable_id
   where s.slug = 'stable-alpha' and t.type = 'stable_general';
commit;

-- Alice reads.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select 'alice_reads_charlie' as q, count(*) from chat_messages where body = 'hello from Charlie (TEST 5)';   -- expect 1
rollback;

-- Eve reads.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);
  select 'eve_reads_charlie' as q, count(*) from chat_messages where body = 'hello from Charlie (TEST 5)';     -- expect 1
rollback;

-- Bob (Bravo) does NOT read.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','b0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select 'bob_reads_charlie' as q, count(*) from chat_messages where body = 'hello from Charlie (TEST 5)';     -- expect 0
rollback;

-- Cleanup the TEST 5 message so subsequent runs stay deterministic.
delete from chat_messages where body = 'hello from Charlie (TEST 5)';


-- =============================================================
-- TEST 6 — Cross-stable INSERT blocked.
-- Alice (owner A) tries to insert a message into Bravo's general
-- thread. The RLS chat_messages_insert policy must reject:
-- thread_id is not in chat_visible_thread_ids() for Alice.
-- Expected: ERROR "new row violates row-level security policy"
-- (or the same-stable trigger fires first if the thread is visible).
-- =============================================================
do $$
declare
  v_bravo_general_id uuid;
  v_stable_alpha     uuid;
begin
  -- Look up cross-stable IDs as postgres (BYPASSRLS).
  select t.id into v_bravo_general_id
    from chat_threads t join stables s on s.id = t.stable_id
   where s.slug = 'stable-bravo' and t.type = 'stable_general';
  select id into v_stable_alpha from stables where slug = 'stable-alpha';

  -- Impersonate Alice and try the malicious insert.
  perform set_config('request.jwt.claims',
    json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  set local role authenticated;

  begin
    insert into chat_messages(stable_id, thread_id, sender_profile_id, body)
    values (v_stable_alpha, v_bravo_general_id, current_user_id(), 'malicious cross-stable post');
    raise notice 'TEST 6 FAILED: cross-stable message insert was accepted';
  exception when others then
    raise notice 'TEST 6 PASSED: % (sqlstate %)', sqlerrm, sqlstate;
  end;
end $$;


-- =============================================================
-- TEST 7 — chat_can_dm pair matrix.
-- Run each impersonation in its own block, verify the pair logic.
-- Expected outcomes inline.
-- =============================================================

-- Alice (owner) targeting Eve (employee)        => true
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select 'owner->employee' as pair, chat_can_dm((select id from profiles where auth_user_id='a0000000-0000-0000-0000-000000000002'));   -- expect true
rollback;

-- Alice (owner) targeting Charlie (client)      => false  (owner cannot DM client)
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select 'owner->client' as pair, chat_can_dm((select id from profiles where auth_user_id='a0000000-0000-0000-0000-000000000003'));     -- expect false
rollback;

-- Eve (employee) targeting Alice (owner)        => true
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);
  select 'employee->owner' as pair, chat_can_dm((select id from profiles where auth_user_id='a0000000-0000-0000-0000-000000000001'));   -- expect true
rollback;

-- Eve (employee) targeting Charlie (client)     => true
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);
  select 'employee->client' as pair, chat_can_dm((select id from profiles where auth_user_id='a0000000-0000-0000-0000-000000000003'));  -- expect true
rollback;

-- Charlie (client) targeting Eve (employee)     => true
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  select 'client->employee' as pair, chat_can_dm((select id from profiles where auth_user_id='a0000000-0000-0000-0000-000000000002'));  -- expect true
rollback;

-- Charlie (client) targeting Alice (owner)      => false  ★ key client/owner deny
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  select 'client->owner' as pair, chat_can_dm((select id from profiles where auth_user_id='a0000000-0000-0000-0000-000000000001'));     -- expect false
rollback;

-- Charlie (client) targeting Diana (client)     => false  ★ client/client deny
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  select 'client->client' as pair, chat_can_dm((select id from profiles where auth_user_id='a0000000-0000-0000-0000-000000000004'));    -- expect false
rollback;

-- Charlie (client A) targeting Beth (client B)  => false  cross-stable deny
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  select 'client_A->client_B' as pair, chat_can_dm((select id from profiles where auth_user_id='b0000000-0000-0000-0000-000000000002')); -- expect false
rollback;

-- Eve (employee) targeting self                 => false
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);
  select 'self' as pair, chat_can_dm(current_user_id());                                                                                  -- expect false
rollback;


-- =============================================================
-- TEST 8 — start_direct_thread happy path.
-- Eve creates a DM with Charlie. Verify thread + 2 participants.
-- (Committed; reused by TESTs 9 and 12.)
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);
  select start_direct_thread((select id from profiles where auth_user_id='a0000000-0000-0000-0000-000000000003')) as thread_id;
commit;

-- Verify (postgres):
select
  (select count(*) from chat_threads where type='direct'
     and stable_id = (select id from stables where slug='stable-alpha')) as alpha_direct_threads,        -- expect 1
  (select count(*) from chat_participants p
     join chat_threads t on t.id = p.thread_id
    where t.type='direct' and t.stable_id = (select id from stables where slug='stable-alpha')) as alpha_direct_participants;  -- expect 2


-- =============================================================
-- TEST 9 — start_direct_thread is idempotent (dedup).
-- Calling again with the same target returns the same thread id;
-- no second thread is created.
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);
  select start_direct_thread((select id from profiles where auth_user_id='a0000000-0000-0000-0000-000000000003')) as thread_id_2nd_call;
rollback;

-- Verify count is still 1.
select count(*) as alpha_direct_thread_count
  from chat_threads where type='direct'
   and stable_id = (select id from stables where slug='stable-alpha');                                    -- expect 1


-- =============================================================
-- TEST 10 — start_direct_thread DENIED for client → owner.
-- Charlie tries to DM Alice. Expected: ERROR 'CHAT_FORBIDDEN'.
-- =============================================================
do $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform start_direct_thread((select id from profiles where auth_user_id='a0000000-0000-0000-0000-000000000001'));
    raise notice 'TEST 10 FAILED: client→owner DM was accepted';
  exception when others then
    raise notice 'TEST 10 PASSED: % (sqlstate %)', sqlerrm, sqlstate;
  end;
end $$;


-- =============================================================
-- TEST 11 — start_direct_thread DENIED for client → client.
-- Charlie tries to DM Diana (both clients in Alpha).
-- Expected: ERROR 'CHAT_FORBIDDEN'.
-- =============================================================
do $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform start_direct_thread((select id from profiles where auth_user_id='a0000000-0000-0000-0000-000000000004'));
    raise notice 'TEST 11 FAILED: client→client DM was accepted';
  exception when others then
    raise notice 'TEST 11 PASSED: % (sqlstate %)', sqlerrm, sqlstate;
  end;
end $$;


-- =============================================================
-- TEST 12 — DM message visibility is strictly limited to participants.
-- Eve posts in the Eve↔Charlie thread (created in TEST 8):
--   * Charlie reads it          -> visible
--   * Alice (owner A) reads it  -> NOT visible (not a participant)
--   * Bob (owner B) reads it    -> NOT visible (cross-stable)
-- =============================================================
-- Eve posts.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);

  insert into chat_messages(stable_id, thread_id, sender_profile_id, body)
  select t.stable_id, t.id, current_user_id(), 'DM from Eve to Charlie (TEST 12)'
    from chat_threads t
   where t.type = 'direct'
     and t.stable_id = (select id from stables where slug='stable-alpha')
   limit 1;
commit;

-- Charlie (participant) reads.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  select 'charlie_sees_dm' as q, count(*) from chat_messages where body = 'DM from Eve to Charlie (TEST 12)';   -- expect 1
rollback;

-- Alice (owner of same stable, NOT a participant) reads.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select 'alice_sees_dm' as q, count(*) from chat_messages where body = 'DM from Eve to Charlie (TEST 12)';     -- expect 0
rollback;

-- Bob (cross-stable) reads.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','b0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select 'bob_sees_dm' as q, count(*) from chat_messages where body = 'DM from Eve to Charlie (TEST 12)';        -- expect 0
rollback;

-- Cleanup TEST 12 message.
delete from chat_messages where body = 'DM from Eve to Charlie (TEST 12)';


-- =============================================================
-- TEST 13 — mark_thread_read upserts last_read_at.
-- Charlie marks Alpha's general thread as read. Verify a
-- chat_participants row exists for him on that thread with a
-- non-null last_read_at, and a second call updates it.
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  select mark_thread_read((select id from chat_threads
                           where type='stable_general'
                             and stable_id = (select id from stables where slug='stable-alpha')));
commit;

-- Verify row exists.
select
  count(*)             as charlie_general_participant_rows,                    -- expect 1
  bool_or(last_read_at is not null) as has_last_read_at                        -- expect true
  from chat_participants p
  join profiles pr on pr.id = p.profile_id
  join chat_threads t on t.id = p.thread_id
 where pr.auth_user_id = 'a0000000-0000-0000-0000-000000000003'
   and t.type = 'stable_general';

-- Re-mark and verify last_read_at moved forward.
do $$
declare v_old timestamptz; v_new timestamptz;
begin
  select last_read_at into v_old
    from chat_participants p
    join profiles pr on pr.id = p.profile_id
    join chat_threads t on t.id = p.thread_id
   where pr.auth_user_id = 'a0000000-0000-0000-0000-000000000003'
     and t.type='stable_general' limit 1;

  perform pg_sleep(0.01);

  perform set_config('request.jwt.claims',
    json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  set local role authenticated;
  perform mark_thread_read((select id from chat_threads
                            where type='stable_general'
                              and stable_id = (select id from stables where slug='stable-alpha')));

  select last_read_at into v_new
    from chat_participants p
    join profiles pr on pr.id = p.profile_id
    join chat_threads t on t.id = p.thread_id
   where pr.auth_user_id = 'a0000000-0000-0000-0000-000000000003'
     and t.type='stable_general' limit 1;

  if v_new > v_old then
    raise notice 'TEST 13 PASSED: last_read_at advanced from % to %', v_old, v_new;
  else
    raise notice 'TEST 13 FAILED: last_read_at did not advance (% vs %)', v_old, v_new;
  end if;
end $$;


-- =============================================================
-- TEST 14 — Soft-deleted message hidden from SELECT.
-- As postgres (BYPASSRLS), insert a message and immediately set
-- deleted_at. Then as Alice, verify it is NOT visible.
-- =============================================================
do $$
declare
  v_thread uuid;
  v_alice_profile uuid;
begin
  select t.id into v_thread
    from chat_threads t
   where t.type='stable_general'
     and t.stable_id = (select id from stables where slug='stable-alpha');
  select id into v_alice_profile from profiles
   where auth_user_id='a0000000-0000-0000-0000-000000000001';

  insert into chat_messages(stable_id, thread_id, sender_profile_id, body, deleted_at)
  values ((select id from stables where slug='stable-alpha'),
          v_thread, v_alice_profile, 'soft-deleted (TEST 14)', now());
end $$;

begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select 'alice_sees_softdeleted' as q, count(*)
    from chat_messages where body = 'soft-deleted (TEST 14)';                  -- expect 0
rollback;

-- Cleanup.
delete from chat_messages where body = 'soft-deleted (TEST 14)';
