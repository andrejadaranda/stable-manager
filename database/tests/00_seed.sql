-- =============================================================
-- 00_seed.sql
-- Run AFTER 01..06 sql files. Creates two stables (Alpha + Bravo)
-- with users, horses, clients, lessons, payments, and one expense.
--
-- Run as the default `postgres` role in the Supabase SQL editor.
-- Auth users are inserted directly into auth.users (superuser-only).
-- =============================================================

-- ---- 1) AUTH USERS --------------------------------------------------
-- Stable Alpha:  Alice (owner), Eve (employee), Charlie (client portal)
-- Stable Bravo:  Bob (owner), Beth (client portal)
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000001','authenticated','authenticated','owner-a@test.local',    crypt('test',gen_salt('bf')), now(), now(), now(), '{"provider":"email"}','{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000002','authenticated','authenticated','employee-a@test.local', crypt('test',gen_salt('bf')), now(), now(), now(), '{"provider":"email"}','{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000003','authenticated','authenticated','client-a1@test.local',  crypt('test',gen_salt('bf')), now(), now(), now(), '{"provider":"email"}','{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000001','authenticated','authenticated','owner-b@test.local',    crypt('test',gen_salt('bf')), now(), now(), now(), '{"provider":"email"}','{}', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000002','authenticated','authenticated','client-b1@test.local',  crypt('test',gen_salt('bf')), now(), now(), now(), '{"provider":"email"}','{}', false, '', '', '', '');

-- ---- 2) PROVISION STABLE ALPHA (Alice as owner) ---------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select provision_stable('Stable Alpha', 'stable-alpha', 'Alice Owner');
commit;

-- ---- 3) ALICE INVITES EVE (employee) AND CHARLIE (client portal) ----
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select attach_user_to_stable('a0000000-0000-0000-0000-000000000002', 'Eve Employee',  'employee');
  select attach_user_to_stable('a0000000-0000-0000-0000-000000000003', 'Charlie Client','client');
commit;

-- ---- 4) PROVISION STABLE BRAVO (Bob as owner) -----------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','b0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select provision_stable('Stable Bravo', 'stable-bravo', 'Bob Owner');
commit;

-- ---- 5) BOB INVITES BETH (client portal) ----------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','b0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  select attach_user_to_stable('b0000000-0000-0000-0000-000000000002', 'Beth Client', 'client');
commit;

-- ---- 6) STABLE ALPHA OPERATIONAL DATA (Alice) -----------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

  -- horses
  insert into horses(stable_id, name) select id, 'Thunder'   from stables where slug = 'stable-alpha';
  insert into horses(stable_id, name) select id, 'Lightning' from stables where slug = 'stable-alpha';

  -- clients (Charlie has portal link, Diana does not)
  insert into clients(stable_id, profile_id, full_name, email, default_lesson_price)
    select s.id, p.id, 'Charlie Client', 'client-a1@test.local', 50
    from stables s, profiles p
    where s.slug = 'stable-alpha' and p.auth_user_id = 'a0000000-0000-0000-0000-000000000003';

  insert into clients(stable_id, full_name, default_lesson_price)
    select id, 'Diana Client', 60 from stables where slug = 'stable-alpha';

  -- lesson 1: Thunder x Charlie x Eve, May 1 10:00-11:00, $50
  insert into lessons(stable_id, horse_id, client_id, trainer_id, starts_at, ends_at, price)
    select s.id, h.id, c.id, t.id,
           '2026-05-01 10:00+00','2026-05-01 11:00+00', 50
    from stables s
    join horses   h on h.stable_id = s.id and h.name = 'Thunder'
    join clients  c on c.stable_id = s.id and c.full_name = 'Charlie Client'
    join profiles t on t.stable_id = s.id and t.role = 'employee'
    where s.slug = 'stable-alpha';

  -- lesson 2: Lightning x Diana x Eve, May 1 14:00-15:00, $60
  insert into lessons(stable_id, horse_id, client_id, trainer_id, starts_at, ends_at, price)
    select s.id, h.id, c.id, t.id,
           '2026-05-01 14:00+00','2026-05-01 15:00+00', 60
    from stables s
    join horses   h on h.stable_id = s.id and h.name = 'Lightning'
    join clients  c on c.stable_id = s.id and c.full_name = 'Diana Client'
    join profiles t on t.stable_id = s.id and t.role = 'employee'
    where s.slug = 'stable-alpha';

  -- Charlie pays $30 (partial — should owe $20)
  insert into payments(stable_id, client_id, amount, method)
    select s.id, c.id, 30, 'cash'
    from stables s
    join clients c on c.stable_id = s.id and c.full_name = 'Charlie Client'
    where s.slug = 'stable-alpha';

  -- Diana pays $60 (settled)
  insert into payments(stable_id, client_id, amount, method)
    select s.id, c.id, 60, 'card'
    from stables s
    join clients c on c.stable_id = s.id and c.full_name = 'Diana Client'
    where s.slug = 'stable-alpha';

  -- one expense
  insert into expenses(stable_id, category, amount, description)
    select id, 'feed', 200, 'Hay delivery'
    from stables where slug = 'stable-alpha';
commit;

-- ---- 7) STABLE BRAVO OPERATIONAL DATA (Bob) -------------------------
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub','b0000000-0000-0000-0000-000000000001','role','authenticated')::text, true);

  insert into horses(stable_id, name) select id, 'Shadow' from stables where slug = 'stable-bravo';

  insert into clients(stable_id, profile_id, full_name, default_lesson_price)
    select s.id, p.id, 'Beth Client', 70
    from stables s, profiles p
    where s.slug = 'stable-bravo' and p.auth_user_id = 'b0000000-0000-0000-0000-000000000002';

  -- lesson: Shadow x Beth x Bob (owner is the trainer here), May 2 09:00-10:00, $70
  insert into lessons(stable_id, horse_id, client_id, trainer_id, starts_at, ends_at, price)
    select s.id, h.id, c.id, t.id,
           '2026-05-02 09:00+00','2026-05-02 10:00+00', 70
    from stables s
    join horses   h on h.stable_id = s.id and h.name = 'Shadow'
    join clients  c on c.stable_id = s.id and c.full_name = 'Beth Client'
    join profiles t on t.stable_id = s.id and t.role = 'owner'
    where s.slug = 'stable-bravo';

  insert into payments(stable_id, client_id, amount, method)
    select s.id, c.id, 70, 'transfer'
    from stables s
    join clients c on c.stable_id = s.id and c.full_name = 'Beth Client'
    where s.slug = 'stable-bravo';
commit;
