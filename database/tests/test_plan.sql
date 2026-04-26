-- =============================================================
-- test_plan.sql
-- 14 tests covering schema install, RLS isolation, role gates,
-- DB-level constraints, business functions, and security RPCs.
--
-- Run AFTER 00_seed.sql. Each block is wrapped in begin/rollback
-- so tests do not modify state. Run blocks individually so you
-- can inspect each result.
--
-- Impersonation idiom inside SQL editor:
--   begin;
--     set local role authenticated;
--     select set_config('request.jwt.claims',
--       json_build_object('sub','<auth_user_id>','role','authenticated')::text,
--       true);
--     ...
--   rollback;
--
-- Useful UUIDs:
--   alice  = a0000000-0000-0000-0000-000000000001  (owner A)
--   eve    = a0000000-0000-0000-0000-000000000002  (employee A)
--   charlie= a0000000-0000-0000-0000-000000000003  (client A)
--   bob    = b0000000-0000-0000-0000-000000000001  (owner B)
--   beth   = b0000000-0000-0000-0000-000000000002  (client B)
-- =============================================================


-- =============================================================
-- TEST 1 — All migration files installed cleanly
-- Expected: every assertion returns the listed value.
-- =============================================================
select
  (select count(*) from information_schema.tables
     where table_schema='public'
       and table_name in ('stables','profiles','horses','clients','lessons','payments','expenses')) as tables_present,  -- expect 7
  (select count(*) from pg_proc
     where proname in ('current_stable_id','current_user_role','current_user_id','current_client_id',
                       'horse_workload','horse_is_overworked','client_balance','check_horse_available',
                       'provision_stable','attach_user_to_stable')) as functions_present,  -- expect 10
  (select count(*) from pg_class
     where relname in ('stables','profiles','horses','clients','lessons','payments','expenses')
       and relrowsecurity and relforcerowsecurity) as tables_with_force_rls,  -- expect 7
  (select count(*) from pg_constraint
     where conrelid = 'public.lessons'::regclass and contype = 'x') as exclusion_constraints;  -- expect 2


-- =============================================================
-- TEST 2 — Owner can create + read their stable's data
-- Run as Alice. Expected counts:
--   stables=1, profiles=3, horses=2, clients=2, lessons=2,
--   payments=2, expenses=1
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

  select 'stables'  as table, count(*) from stables
  union all select 'profiles', count(*) from profiles
  union all select 'horses',   count(*) from horses
  union all select 'clients',  count(*) from clients
  union all select 'lessons',  count(*) from lessons
  union all select 'payments', count(*) from payments
  union all select 'expenses', count(*) from expenses;
rollback;


-- =============================================================
-- TEST 3 — Employee sees horses/clients/calendar but NOT
-- payments or expenses. Run as Eve.
-- Expected:
--   horses=2, clients=2, lessons=2, payments=0, expenses=0
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);

  select 'horses'   as table, count(*) from horses
  union all select 'clients',  count(*) from clients
  union all select 'lessons',  count(*) from lessons
  union all select 'payments', count(*) from payments   -- expect 0
  union all select 'expenses', count(*) from expenses;  -- expect 0
rollback;


-- =============================================================
-- TEST 4 — Client sees ONLY their own profile, lessons,
-- payments. Run as Charlie.
-- Expected:
--   profiles=1 (own), horses=0, clients=1 (own),
--   lessons=1 (own), payments=1 (own), expenses=0
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);

  select 'profiles' as table, count(*) from profiles
  union all select 'horses',   count(*) from horses
  union all select 'clients',  count(*) from clients
  union all select 'lessons',  count(*) from lessons
  union all select 'payments', count(*) from payments
  union all select 'expenses', count(*) from expenses;

  -- own profile sanity
  select role, full_name from profiles where auth_user_id = auth.uid();
  -- expect: client, Charlie Client
rollback;


-- =============================================================
-- TEST 5 — Client cannot read another client's data.
-- Charlie should NOT see Diana's row, lesson, or payment.
-- Expected: every query returns 0 rows.
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);

  select 'diana_client_visible'  as q, count(*) from clients  where full_name = 'Diana Client'
  union all
  select 'diana_lesson_visible',     count(*) from lessons  l
    join clients c on c.id = l.client_id
    where c.full_name = 'Diana Client'
  union all
  select 'diana_payment_visible',    count(*) from payments p
    join clients c on c.id = p.client_id
    where c.full_name = 'Diana Client';
rollback;


-- =============================================================
-- TEST 6 — Stable A user cannot see Stable B data.
-- Run as Alice. Expected: only stable-alpha visible everywhere.
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

  select 'stable_slugs_visible' as q, string_agg(slug, ',') from stables;     -- expect: stable-alpha
  select 'horse_names_visible',       string_agg(name, ',') from horses;       -- expect: Thunder,Lightning (only)
  select 'shadow_visible_count',      count(*)              from horses where name = 'Shadow';  -- expect 0
  select 'beth_visible_count',        count(*)              from clients where full_name = 'Beth Client';  -- expect 0
rollback;

-- And the inverse, run as Bob — expect only stable-bravo data.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','b0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select 'stable_slugs_visible' as q, string_agg(slug, ',') from stables;     -- expect: stable-bravo
  select 'horse_names_visible',       string_agg(name, ',') from horses;       -- expect: Shadow
  select 'thunder_visible_count',     count(*)              from horses where name = 'Thunder';  -- expect 0
rollback;


-- =============================================================
-- TEST 7 — Horse double-booking blocked at DB level.
-- Existing lesson: Thunder, May 1 10:00-11:00.
-- Try to insert overlapping lesson on Thunder (10:30-11:30).
-- Expected: ERROR, SQLSTATE 23P01,
--   "conflicting key value violates exclusion constraint
--    no_horse_double_booking"
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

  insert into lessons(stable_id, horse_id, client_id, trainer_id, starts_at, ends_at, price)
  select s.id, h.id, c.id, t.id,
         '2026-05-01 10:30+00','2026-05-01 11:30+00', 50
  from stables s
  join horses   h on h.stable_id = s.id and h.name = 'Thunder'
  join clients  c on c.stable_id = s.id and c.full_name = 'Diana Client'
  join profiles t on t.stable_id = s.id and t.role = 'owner'
  where s.slug = 'stable-alpha';
rollback;


-- =============================================================
-- TEST 8 — Trainer double-booking blocked at DB level.
-- Eve has a lesson at May 1 10:00-11:00. Try to book Eve again
-- at 10:30-11:30 on a DIFFERENT horse (Lightning).
-- Expected: ERROR, SQLSTATE 23P01,
--   "conflicting key value violates exclusion constraint
--    no_trainer_double_booking"
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

  insert into lessons(stable_id, horse_id, client_id, trainer_id, starts_at, ends_at, price)
  select s.id, h.id, c.id, t.id,
         '2026-05-01 10:30+00','2026-05-01 11:30+00', 50
  from stables s
  join horses   h on h.stable_id = s.id and h.name = 'Lightning'   -- different horse
  join clients  c on c.stable_id = s.id and c.full_name = 'Diana Client'
  join profiles t on t.stable_id = s.id and t.role = 'employee'    -- same trainer (Eve)
  where s.slug = 'stable-alpha';
rollback;


-- =============================================================
-- TEST 9 — Payment cannot reference a client from another stable.
-- Owner A tries to insert a payment in Stable A but pointing to
-- Stable B's client UUID.
-- Expected: ERROR "client ... does not belong to stable ..."
-- (raised by payments_enforce_same_stable trigger).
-- =============================================================
do $$
declare
  v_stable_a uuid;
  v_client_b uuid;
begin
  -- runs as postgres (BYPASSRLS) to look up cross-stable UUIDs
  select id into v_stable_a from stables where slug = 'stable-alpha';
  select c.id into v_client_b
    from clients c join stables s on s.id = c.stable_id
    where s.slug = 'stable-bravo' and c.full_name = 'Beth Client';

  -- now impersonate Owner A and attempt the malicious insert
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

  begin
    insert into payments(stable_id, client_id, amount, method)
    values (v_stable_a, v_client_b, 99, 'cash');
    raise notice 'TEST 9 FAILED: cross-stable payment was accepted';
  exception when others then
    raise notice 'TEST 9 PASSED: % (sqlstate %)', sqlerrm, sqlstate;
  end;
end $$;


-- =============================================================
-- TEST 10 — Expense cannot reference a horse from another stable.
-- Owner A tries to record an expense in Stable A but tagged to
-- Stable B's horse (Shadow).
-- Expected: ERROR "horse ... does not belong to stable ..."
-- (raised by expenses_enforce_same_stable trigger).
-- =============================================================
do $$
declare
  v_stable_a uuid;
  v_horse_b  uuid;
begin
  select id into v_stable_a from stables where slug = 'stable-alpha';
  select h.id into v_horse_b
    from horses h join stables s on s.id = h.stable_id
    where s.slug = 'stable-bravo' and h.name = 'Shadow';

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

  begin
    insert into expenses(stable_id, category, amount, description, horse_id)
    values (v_stable_a, 'vet', 50, 'malicious cross-stable expense', v_horse_b);
    raise notice 'TEST 10 FAILED: cross-stable expense was accepted';
  exception when others then
    raise notice 'TEST 10 PASSED: % (sqlstate %)', sqlerrm, sqlstate;
  end;
end $$;


-- =============================================================
-- TEST 11 — client_balance returns correct results.
-- Charlie: charged 50, paid 30 -> balance -20 (owes 20)
-- Diana:   charged 60, paid 60 -> balance 0
-- Beth:    charged 70, paid 70 -> balance 0
-- Run as the respective stable owner so RLS lets us see all data.
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select c.full_name, client_balance(c.id) as balance
  from clients c order by c.full_name;
  -- expect: Charlie Client = -20, Diana Client = 0
rollback;

begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','b0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select c.full_name, client_balance(c.id) as balance from clients c;
  -- expect: Beth Client = 0
rollback;

-- And Charlie reading his OWN balance via RLS:
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  select client_balance(c.id) as my_balance from clients c where c.id = current_client_id();
  -- expect: -20
rollback;


-- =============================================================
-- TEST 12 — horse_workload returns correct results.
-- Window May 1 00:00 -> May 2 00:00:
--   Thunder:   1 lesson, 60 minutes
--   Lightning: 1 lesson, 60 minutes
--   Shadow:    0 in stable A's window (visible as 0 to Bob too on May 1)
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select h.name, w.*
  from horses h
  cross join lateral horse_workload(h.id, '2026-05-01 00:00+00','2026-05-02 00:00+00') w
  order by h.name;
  -- expect: Lightning -> 1,60   Thunder -> 1,60
rollback;

begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','b0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select h.name, w.*
  from horses h
  cross join lateral horse_workload(h.id, '2026-05-02 00:00+00','2026-05-03 00:00+00') w;
  -- expect: Shadow -> 1,60
rollback;


-- =============================================================
-- TEST 13 — attach_user_to_stable cannot move a user across
-- stables. Bob (owner B) tries to absorb Charlie (already in A).
-- Expected: ERROR "auth user already belongs to a stable".
-- =============================================================
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','b0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select attach_user_to_stable('a0000000-0000-0000-0000-000000000003', 'Charlie hijacked', 'client');
rollback;


-- =============================================================
-- TEST 14 — Self-promotion is blocked.
-- 14a: Charlie (client) tries to promote himself to owner.
--      Expected: 0 rows updated (no policy permits the write).
-- 14b: Eve (employee) tries to promote herself.
--      Expected: 0 rows updated.
-- 14c: Charlie tries to call attach_user_to_stable for himself.
--      Expected: ERROR "only owners can attach users".
-- =============================================================
-- 14a
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  with upd as (
    update profiles set role = 'owner' where auth_user_id = auth.uid() returning id
  )
  select count(*) as rows_updated_by_charlie from upd;   -- expect 0
  -- sanity: still a client?
  select role from profiles where auth_user_id = auth.uid();   -- expect: client
rollback;

-- 14b
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000002','role','authenticated')::text, true);
  with upd as (
    update profiles set role = 'owner' where auth_user_id = auth.uid() returning id
  )
  select count(*) as rows_updated_by_eve from upd;       -- expect 0
  select role from profiles where auth_user_id = auth.uid();   -- expect: employee
rollback;

-- 14c
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000003','role','authenticated')::text, true);
  select attach_user_to_stable('a0000000-0000-0000-0000-000000000003', 'self-promote', 'employee');
  -- Expected: ERROR "only owners can attach users"
rollback;
