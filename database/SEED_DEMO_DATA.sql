-- =============================================================
-- SEED_DEMO_DATA.sql
--
-- Populates the FIRST stable found in the DB with realistic test
-- data so Andreja can see what a busy stable looks like.
--
-- Includes:
--   12 horses (varied breeds, ages, with photos + bios)
--   20 clients (skill mix, some with emergency contacts)
--    6 services (lesson types + price list)
--    4 lesson packages (active + nearly-used)
--   ~40 lessons (past 14d + next 14d, multi-trainer-safe)
--   ~25 sessions (training rides, hacks, lunging)
--    8 horse boarding charges (mix paid / unpaid)
--    6 misc client charges (farrier / equipment / vet copay)
--   25 payments (cash / card / transfer)
--   15 expenses (feed / vet / farrier / etc.)
--    8 health records (vaccinations + farrier with future due dates,
--                      including 2 OVERDUE so Smart Suggestions lights up)
--    5 reminders (some due today, some completed)
--    3 client agreements
--
-- Idempotent: checks for an existing seed marker; re-running won't
-- duplicate. Tagged with 'seed:' prefix in notes/description so you
-- can clean up later (see CLEANUP_SEED_DATA.sql below).
--
-- Run as: paste into Supabase SQL Editor and click Run.
-- =============================================================

do $seed$
declare
  v_stable_id   uuid;
  v_owner_id    uuid;

  -- horse uuids
  v_h_bella     uuid := gen_random_uuid();
  v_h_apollo    uuid := gen_random_uuid();
  v_h_atlas     uuid := gen_random_uuid();
  v_h_luna      uuid := gen_random_uuid();
  v_h_storm     uuid := gen_random_uuid();
  v_h_zorba     uuid := gen_random_uuid();
  v_h_dakota    uuid := gen_random_uuid();
  v_h_rosie     uuid := gen_random_uuid();
  v_h_nova      uuid := gen_random_uuid();
  v_h_finn      uuid := gen_random_uuid();
  v_h_ivy       uuid := gen_random_uuid();
  v_h_oscar     uuid := gen_random_uuid();

  -- client uuids
  v_c_anna      uuid := gen_random_uuid();
  v_c_marta     uuid := gen_random_uuid();
  v_c_jonas     uuid := gen_random_uuid();
  v_c_sophie    uuid := gen_random_uuid();
  v_c_lukas     uuid := gen_random_uuid();
  v_c_emma      uuid := gen_random_uuid();
  v_c_mia       uuid := gen_random_uuid();
  v_c_eva       uuid := gen_random_uuid();
  v_c_tomas     uuid := gen_random_uuid();
  v_c_lea       uuid := gen_random_uuid();
  v_c_klara     uuid := gen_random_uuid();
  v_c_petras    uuid := gen_random_uuid();
  v_c_julia     uuid := gen_random_uuid();
  v_c_marija    uuid := gen_random_uuid();
  v_c_dovile    uuid := gen_random_uuid();
  v_c_simona    uuid := gen_random_uuid();
  v_c_paul      uuid := gen_random_uuid();
  v_c_lina      uuid := gen_random_uuid();
  v_c_egle      uuid := gen_random_uuid();
  v_c_oliver    uuid := gen_random_uuid();

  -- services
  v_s_beg45     uuid := gen_random_uuid();
  v_s_beg30     uuid := gen_random_uuid();
  v_s_int60     uuid := gen_random_uuid();
  v_s_jump      uuid := gen_random_uuid();
  v_s_lunge     uuid := gen_random_uuid();
  v_s_hack      uuid := gen_random_uuid();

  -- packages
  v_pkg_anna    uuid := gen_random_uuid();
  v_pkg_lukas   uuid := gen_random_uuid();
  v_pkg_emma    uuid := gen_random_uuid();
  v_pkg_klara   uuid := gen_random_uuid();

  v_today       date := current_date;
  v_now         timestamptz := now();
begin
  -- Pick the first stable + an owner profile. Adjust the where clause
  -- if you want to seed a specific slug.
  select id into v_stable_id from stables limit 1;
  if v_stable_id is null then
    raise exception 'No stable found — sign up first, then run this seed.';
  end if;

  select id into v_owner_id from profiles
   where stable_id = v_stable_id and role = 'owner'
   limit 1;
  if v_owner_id is null then
    raise exception 'No owner profile found for stable %', v_stable_id;
  end if;

  -- Seed marker — bail out gracefully if already populated.
  if exists (select 1 from horses where stable_id = v_stable_id and notes like 'seed:%') then
    raise notice 'Seed data already present — skipping.';
    return;
  end if;

  -- =========================================================
  -- HORSES (12)
  -- =========================================================
  insert into horses (id, stable_id, name, breed, date_of_birth, daily_lesson_limit, weekly_lesson_limit, active, notes, public_bio) values
    (v_h_bella,  v_stable_id, 'Bella',  'Trakehner',           '2014-05-12', 4, 18, true, 'seed: gentle, great with beginners',                'Chestnut mare with a white blaze. Loves carrots and is patient with new riders.'),
    (v_h_apollo, v_stable_id, 'Apollo', 'Hanoverian',          '2012-03-08', 3, 15, true, 'seed: strong jumper, advanced only',                 'Bay gelding, 16.2 hh. Confident jumper, prefers experienced riders.'),
    (v_h_atlas,  v_stable_id, 'Atlas',  'Heavy draft',         '2010-09-21', 5, 22, true, 'seed: steady workhorse, great for groups',           'Big-hearted gentle giant. Perfect for confidence-building lessons.'),
    (v_h_luna,   v_stable_id, 'Luna',   'Lithuanian Heavy',    '2015-07-04', 4, 18, true, 'seed: arrived March 2024',                            null),
    (v_h_storm,  v_stable_id, 'Storm',  'Holsteiner',          '2013-11-15', 3, 14, true, 'seed: occasional spook, 12+ riders only',             'Dapple grey gelding. Forward-going, best suited to riders who can sit a buck.'),
    (v_h_zorba,  v_stable_id, 'Zorba',  'Andalusian',          '2011-06-30', 3, 13, true, 'seed: dressage specialist',                            'Black PRE stallion. Elegant mover, dressage-trained to second level.'),
    (v_h_dakota, v_stable_id, 'Dakota', 'Quarter Horse',       '2016-04-18', 4, 18, true, 'seed: green broke 2024',                              null),
    (v_h_rosie,  v_stable_id, 'Rosie',  'Welsh Pony',          '2018-08-22', 5, 20, true, 'seed: kid favourite',                                  'Strawberry roan pony. The safest first ride.'),
    (v_h_nova,   v_stable_id, 'Nova',   'Oldenburg',           '2014-02-14', 3, 14, true, 'seed: in training for 1.10m',                          'Dark bay mare. Athletic jumper progressing through the 1m classes.'),
    (v_h_finn,   v_stable_id, 'Finn',   'Connemara',           '2017-05-09', 4, 16, true, 'seed: quick learner',                                  null),
    (v_h_ivy,    v_stable_id, 'Ivy',    'Friesian',            '2013-10-03', 3, 12, true, 'seed: sensitive — quiet hands only',                   'Black Friesian mare. Striking presence, sensitive to leg aids.'),
    (v_h_oscar,  v_stable_id, 'Oscar',  'Irish Sport Horse',   '2012-12-01', 3, 14, true, 'seed: cross-country machine',                           'Bay gelding. Eventing veteran, three Pony Club graduations.');

  update horses set monthly_boarding_fee = 380 where id in (v_h_storm, v_h_zorba);
  update horses set monthly_boarding_fee = 320 where id in (v_h_nova, v_h_oscar);
  update horses set available_for_lessons = true where id in (v_h_storm, v_h_nova, v_h_oscar);

  -- =========================================================
  -- CLIENTS (20)
  -- =========================================================
  insert into clients (id, stable_id, full_name, email, phone, default_lesson_price, skill_level, active, notes,
                       emergency_contact_name, emergency_contact_phone, emergency_contact_relation) values
    (v_c_anna,   v_stable_id, 'Anna Müller',     'anna@example.com',     '+49 170 1234567', 30, 'intermediate', true, 'seed: rides Bella weekly', 'Markus Müller',  '+49 170 2222111', 'spouse'),
    (v_c_marta,  v_stable_id, 'Marta Berg',      'marta@example.com',    '+49 171 2345678', 35, 'advanced',     true, 'seed: jumps 1.10m on Apollo', null, null, null),
    (v_c_jonas,  v_stable_id, 'Jonas Becker',    null,                    '+49 172 3456789', 25, 'beginner',     true, 'seed: started March', 'Helga Becker', '+49 172 9000111', 'mother'),
    (v_c_sophie, v_stable_id, 'Sophie Lambert',  'sophie@example.com',   '+33 6 12345678',  45, 'pro',          true, 'seed: trains horses for resale', null, null, null),
    (v_c_lukas,  v_stable_id, 'Lukas Petrauskas','lukas@example.com',    '+370 612 34567',  30, 'intermediate', true, 'seed: 12 yo, parent pays', 'Ruta Petrauskiene', '+370 612 11111', 'mother'),
    (v_c_emma,   v_stable_id, 'Emma Novak',      null,                   '+420 720 111 222', 30, 'intermediate', true, 'seed: switching to dressage', null, null, null),
    (v_c_mia,    v_stable_id, 'Mia Larsen',      'mia@example.com',      '+47 91 234 567',  30, 'beginner',     true, 'seed: scared of canter', 'Erik Larsen',     '+47 91 999 888', 'father'),
    (v_c_eva,    v_stable_id, 'Eva Kowalska',    'eva@example.com',      '+48 600 234 567', 35, 'advanced',     true, 'seed: shows monthly', null, null, null),
    (v_c_tomas,  v_stable_id, 'Tomas Vilkas',    null,                   '+370 614 22 333', 30, 'intermediate', true, 'seed: weekend rider', null, null, null),
    (v_c_lea,    v_stable_id, 'Lea Hofer',       'lea@example.com',      '+43 660 123 456', 25, 'beginner',     true, 'seed: just started', 'Anna Hofer', '+43 660 999 000', 'mother'),
    (v_c_klara,  v_stable_id, 'Klara Schulz',    'klara@example.com',    '+49 175 9999111', 30, 'intermediate', true, 'seed: bought 10-pack', null, null, null),
    (v_c_petras, v_stable_id, 'Petras Kavaliauskas','petras@example.com','+370 615 33 444', 35, 'advanced',     true, 'seed: owns Storm', null, null, null),
    (v_c_julia,  v_stable_id, 'Julia Romano',    'julia@example.com',    '+39 333 1112233', 35, 'intermediate', true, 'seed: returning rider after 5y break', null, null, null),
    (v_c_marija, v_stable_id, 'Marija Žemaitė',  null,                   '+370 616 44 555', 30, 'intermediate', true, 'seed: rides Finn on Tuesdays', 'Algis Žemaitis', '+370 616 99 999', 'father'),
    (v_c_dovile, v_stable_id, 'Dovilė Petrulienė','dovile@example.com',  '+370 618 55 666', 35, 'advanced',     true, 'seed: owns Nova', null, null, null),
    (v_c_simona, v_stable_id, 'Simona Vaitkevičiūtė',null,               '+370 619 66 777', 25, 'beginner',     true, 'seed: 8 yo, lessons on Rosie',  'Ramunė Vaitkevičienė', '+370 619 88 999', 'mother'),
    (v_c_paul,   v_stable_id, 'Paul Andersson',  'paul@example.com',     '+46 70 234 5678', 35, 'advanced',     true, 'seed: visiting from Sweden monthly', null, null, null),
    (v_c_lina,   v_stable_id, 'Lina Janulytė',   null,                   '+370 620 77 888', 30, 'intermediate', true, 'seed: owns Oscar — keeps him for events', null, null, null),
    (v_c_egle,   v_stable_id, 'Eglė Kalinauskaitė','egle@example.com',   '+370 621 88 999', 30, 'intermediate', true, 'seed: started January', null, null, null),
    (v_c_oliver, v_stable_id, 'Oliver Wagner',   'oliver@example.com',   '+49 176 5556677', 45, 'pro',          true, 'seed: clinic instructor occasional', null, null, null);

  -- Boarders: Storm = Petras, Nova = Dovilė, Oscar = Lina
  update horses set owner_client_id = v_c_petras  where id = v_h_storm;
  update horses set owner_client_id = v_c_dovile  where id = v_h_nova;
  update horses set owner_client_id = v_c_lina    where id = v_h_oscar;

  -- Backup contact for boarder horses
  update horses set
    backup_contact_name     = 'Dr. Kestutis Vet',
    backup_contact_phone    = '+370 685 11 222',
    backup_contact_relation = 'vet'
  where id in (v_h_storm, v_h_nova, v_h_oscar);

  -- =========================================================
  -- SERVICES (6 — the price list)
  -- =========================================================
  insert into services (id, stable_id, name, description, base_price, default_duration_minutes, sort_order) values
    (v_s_beg30,  v_stable_id, 'Beginner — 30 min',  'Walk + intro trot. Lead-rein for under-10s.',         18.00, 30, 10),
    (v_s_beg45,  v_stable_id, 'Beginner — 45 min',  'Standard private lesson, all paces.',                 25.00, 45, 20),
    (v_s_int60,  v_stable_id, 'Intermediate — 60 min','Flatwork, light pole work.',                        30.00, 60, 30),
    (v_s_jump,   v_stable_id, 'Show jumping — 60 min','Jump lesson, gridwork to courses.',                 35.00, 60, 40),
    (v_s_lunge,  v_stable_id, 'Lunge lesson — 30 min','Position work without reins. Ideal for fixing seat.', 22.00, 30, 50),
    (v_s_hack,   v_stable_id, 'Hack — 90 min',       'Group hack in the forest. Min. intermediate level.',  40.00, 90, 60);

  -- =========================================================
  -- LESSON PACKAGES (4)
  -- =========================================================
  insert into lesson_packages (id, stable_id, client_id, total_lessons, price, purchased_at, expires_at, notes) values
    (v_pkg_anna,  v_stable_id, v_c_anna,  10, 240.00, v_now - interval '20 days', v_now + interval '70 days', 'seed: 10-pack, 4 used'),
    (v_pkg_lukas, v_stable_id, v_c_lukas, 12, 300.00, v_now - interval '40 days', v_now + interval '50 days', 'seed: kid 12-pack'),
    (v_pkg_emma,  v_stable_id, v_c_emma,   8, 240.00, v_now - interval '10 days', v_now + interval '80 days', 'seed: dressage 8-pack'),
    (v_pkg_klara, v_stable_id, v_c_klara, 10, 300.00, v_now - interval '60 days', v_now + interval '30 days', 'seed: nearly used up');

  -- =========================================================
  -- LESSONS (~40, spread past 14d + next 14d)
  -- Carefully staggered so no horse + no trainer is double-booked.
  -- =========================================================
  -- All lessons share the owner as trainer (single-trainer scenario).
  -- Times are local (Europe/Vilnius); we just use timestamptz literals.

  -- Past lessons (some completed, some cancelled, some no_show)
  insert into lessons (stable_id, horse_id, client_id, trainer_id, starts_at, ends_at, price, status, package_id, service_id, notes) values
    (v_stable_id, v_h_bella,  v_c_anna,    v_owner_id, v_now - interval '13 days' + interval '17 hours', v_now - interval '13 days' + interval '17 hours 45 minutes', 25, 'completed', v_pkg_anna, v_s_beg45, 'seed:'),
    (v_stable_id, v_h_apollo, v_c_marta,   v_owner_id, v_now - interval '12 days' + interval '18 hours', v_now - interval '12 days' + interval '19 hours',            35, 'completed', null, v_s_jump,  'seed:'),
    (v_stable_id, v_h_atlas,  v_c_jonas,   v_owner_id, v_now - interval '12 days' + interval '14 hours', v_now - interval '12 days' + interval '14 hours 45 minutes', 25, 'completed', null, v_s_beg45, 'seed:'),
    (v_stable_id, v_h_rosie,  v_c_simona,  v_owner_id, v_now - interval '11 days' + interval '15 hours', v_now - interval '11 days' + interval '15 hours 30 minutes', 18, 'completed', null, v_s_beg30, 'seed:'),
    (v_stable_id, v_h_zorba,  v_c_emma,    v_owner_id, v_now - interval '10 days' + interval '17 hours', v_now - interval '10 days' + interval '18 hours',            30, 'completed', v_pkg_emma, v_s_int60, 'seed:'),
    (v_stable_id, v_h_bella,  v_c_anna,    v_owner_id, v_now - interval '9 days'  + interval '17 hours', v_now - interval '9 days'  + interval '17 hours 45 minutes', 25, 'completed', v_pkg_anna, v_s_beg45, 'seed:'),
    (v_stable_id, v_h_dakota, v_c_lukas,   v_owner_id, v_now - interval '9 days'  + interval '16 hours', v_now - interval '9 days'  + interval '16 hours 45 minutes', 25, 'completed', v_pkg_lukas, v_s_beg45, 'seed:'),
    (v_stable_id, v_h_finn,   v_c_marija,  v_owner_id, v_now - interval '8 days'  + interval '18 hours', v_now - interval '8 days'  + interval '19 hours',            30, 'completed', null, v_s_int60, 'seed:'),
    (v_stable_id, v_h_apollo, v_c_marta,   v_owner_id, v_now - interval '7 days'  + interval '18 hours', v_now - interval '7 days'  + interval '19 hours',            35, 'completed', null, v_s_jump,  'seed:'),
    (v_stable_id, v_h_atlas,  v_c_lea,     v_owner_id, v_now - interval '7 days'  + interval '14 hours', v_now - interval '7 days'  + interval '14 hours 45 minutes', 25, 'completed', null, v_s_beg45, 'seed:'),
    (v_stable_id, v_h_luna,   v_c_klara,   v_owner_id, v_now - interval '6 days'  + interval '17 hours', v_now - interval '6 days'  + interval '18 hours',            30, 'cancelled', v_pkg_klara, v_s_int60, 'seed: client called in sick'),
    (v_stable_id, v_h_storm,  v_c_petras,  v_owner_id, v_now - interval '6 days'  + interval '19 hours', v_now - interval '6 days'  + interval '20 hours',            30, 'completed', null, v_s_int60, 'seed:'),
    (v_stable_id, v_h_oscar,  v_c_lina,    v_owner_id, v_now - interval '5 days'  + interval '16 hours', v_now - interval '5 days'  + interval '17 hours',            35, 'completed', null, v_s_jump,  'seed:'),
    (v_stable_id, v_h_rosie,  v_c_simona,  v_owner_id, v_now - interval '4 days'  + interval '15 hours', v_now - interval '4 days'  + interval '15 hours 30 minutes', 18, 'no_show',   null, v_s_beg30, 'seed: kid had flu'),
    (v_stable_id, v_h_bella,  v_c_anna,    v_owner_id, v_now - interval '2 days'  + interval '17 hours', v_now - interval '2 days'  + interval '17 hours 45 minutes', 25, 'completed', v_pkg_anna, v_s_beg45, 'seed:'),
    (v_stable_id, v_h_apollo, v_c_oliver,  v_owner_id, v_now - interval '2 days'  + interval '18 hours 30 minutes', v_now - interval '2 days' + interval '19 hours 30 minutes', 45, 'completed', null, v_s_jump, 'seed: pro clinic ride'),
    (v_stable_id, v_h_zorba,  v_c_sophie,  v_owner_id, v_now - interval '1 days'  + interval '17 hours', v_now - interval '1 days'  + interval '18 hours',            45, 'completed', null, v_s_int60, 'seed: pro session');

  -- Today + tomorrow (mix of statuses)
  insert into lessons (stable_id, horse_id, client_id, trainer_id, starts_at, ends_at, price, status, package_id, service_id, notes) values
    (v_stable_id, v_h_bella,  v_c_anna,    v_owner_id, v_today + interval '17 hours',                       v_today + interval '17 hours 45 minutes', 25, 'scheduled', v_pkg_anna, v_s_beg45, 'seed:'),
    (v_stable_id, v_h_atlas,  v_c_jonas,   v_owner_id, v_today + interval '14 hours',                       v_today + interval '14 hours 45 minutes', 25, 'scheduled', null, v_s_beg45, 'seed:'),
    (v_stable_id, v_h_rosie,  v_c_simona,  v_owner_id, v_today + interval '15 hours',                       v_today + interval '15 hours 30 minutes', 18, 'scheduled', null, v_s_beg30, 'seed:'),
    (v_stable_id, v_h_apollo, v_c_marta,   v_owner_id, v_today + interval '18 hours',                       v_today + interval '19 hours',            35, 'scheduled', null, v_s_jump,  'seed:'),
    (v_stable_id, v_h_storm,  v_c_petras,  v_owner_id, v_today + interval '19 hours',                       v_today + interval '20 hours',            30, 'scheduled', null, v_s_int60, 'seed:'),
    (v_stable_id, v_h_dakota, v_c_lukas,   v_owner_id, v_today + interval '1 days' + interval '16 hours',   v_today + interval '1 days' + interval '16 hours 45 minutes', 25, 'scheduled', v_pkg_lukas, v_s_beg45, 'seed:'),
    (v_stable_id, v_h_finn,   v_c_marija,  v_owner_id, v_today + interval '1 days' + interval '18 hours',   v_today + interval '1 days' + interval '19 hours',            30, 'scheduled', null, v_s_int60, 'seed:'),
    (v_stable_id, v_h_zorba,  v_c_emma,    v_owner_id, v_today + interval '1 days' + interval '17 hours',   v_today + interval '1 days' + interval '18 hours',            30, 'scheduled', v_pkg_emma, v_s_int60, 'seed:'),
    (v_stable_id, v_h_oscar,  v_c_lina,    v_owner_id, v_today + interval '2 days' + interval '16 hours',   v_today + interval '2 days' + interval '17 hours',            35, 'scheduled', null, v_s_jump,  'seed:'),
    (v_stable_id, v_h_atlas,  v_c_lea,     v_owner_id, v_today + interval '2 days' + interval '14 hours',   v_today + interval '2 days' + interval '14 hours 45 minutes', 25, 'scheduled', null, v_s_beg45, 'seed:'),
    (v_stable_id, v_h_bella,  v_c_julia,   v_owner_id, v_today + interval '3 days' + interval '17 hours',   v_today + interval '3 days' + interval '17 hours 45 minutes', 25, 'scheduled', null, v_s_beg45, 'seed:'),
    (v_stable_id, v_h_apollo, v_c_marta,   v_owner_id, v_today + interval '4 days' + interval '18 hours',   v_today + interval '4 days' + interval '19 hours',            35, 'scheduled', null, v_s_jump,  'seed:'),
    (v_stable_id, v_h_luna,   v_c_klara,   v_owner_id, v_today + interval '5 days' + interval '17 hours',   v_today + interval '5 days' + interval '18 hours',            30, 'scheduled', v_pkg_klara, v_s_int60, 'seed:'),
    (v_stable_id, v_h_rosie,  v_c_simona,  v_owner_id, v_today + interval '5 days' + interval '15 hours',   v_today + interval '5 days' + interval '15 hours 30 minutes', 18, 'scheduled', null, v_s_beg30, 'seed:'),
    (v_stable_id, v_h_storm,  v_c_petras,  v_owner_id, v_today + interval '6 days' + interval '19 hours',   v_today + interval '6 days' + interval '20 hours',            30, 'scheduled', null, v_s_int60, 'seed:'),
    (v_stable_id, v_h_dakota, v_c_tomas,   v_owner_id, v_today + interval '7 days' + interval '16 hours',   v_today + interval '7 days' + interval '16 hours 45 minutes', 25, 'scheduled', null, v_s_beg45, 'seed:'),
    (v_stable_id, v_h_finn,   v_c_egle,    v_owner_id, v_today + interval '7 days' + interval '17 hours',   v_today + interval '7 days' + interval '18 hours',            30, 'scheduled', null, v_s_int60, 'seed:'),
    (v_stable_id, v_h_ivy,    v_c_eva,     v_owner_id, v_today + interval '8 days' + interval '17 hours 30 minutes', v_today + interval '8 days' + interval '18 hours 30 minutes', 35, 'scheduled', null, v_s_jump, 'seed:'),
    (v_stable_id, v_h_oscar,  v_c_lina,    v_owner_id, v_today + interval '9 days' + interval '16 hours',   v_today + interval '9 days' + interval '17 hours',            35, 'scheduled', null, v_s_jump,  'seed:'),
    (v_stable_id, v_h_nova,   v_c_dovile,  v_owner_id, v_today + interval '10 days'+ interval '18 hours',   v_today + interval '10 days'+ interval '19 hours',            35, 'scheduled', null, v_s_jump,  'seed:'),
    (v_stable_id, v_h_zorba,  v_c_sophie,  v_owner_id, v_today + interval '11 days'+ interval '17 hours',   v_today + interval '11 days'+ interval '18 hours',            45, 'scheduled', null, v_s_int60, 'seed:'),
    (v_stable_id, v_h_atlas,  v_c_paul,    v_owner_id, v_today + interval '12 days'+ interval '14 hours',   v_today + interval '12 days'+ interval '15 hours 30 minutes', 40, 'scheduled', null, v_s_hack,  'seed: forest hack'),
    (v_stable_id, v_h_bella,  v_c_anna,    v_owner_id, v_today + interval '14 days'+ interval '17 hours',   v_today + interval '14 days'+ interval '17 hours 45 minutes', 25, 'scheduled', v_pkg_anna, v_s_beg45, 'seed:');

  -- =========================================================
  -- SESSIONS (~25 — training, hacks, lunging not counted as lessons)
  -- =========================================================
  insert into sessions (stable_id, horse_id, rider_client_id, trainer_id, started_at, duration_minutes, type, notes, rating) values
    (v_stable_id, v_h_storm,  v_c_petras,  v_owner_id, v_now - interval '14 days', 60, 'flat',       'seed: warm-up + lateral work', 4),
    (v_stable_id, v_h_nova,   v_c_dovile,  v_owner_id, v_now - interval '12 days', 90, 'jumping',    'seed: 1.05m course practice', 5),
    (v_stable_id, v_h_oscar,  v_c_lina,    v_owner_id, v_now - interval '11 days', 75, 'hack',       'seed: forest loop', 4),
    (v_stable_id, v_h_zorba,  v_c_sophie,  v_owner_id, v_now - interval '10 days', 60, 'flat',       'seed: piaffe transitions', 5),
    (v_stable_id, v_h_apollo, null,        v_owner_id, v_now - interval '9 days',  45, 'lunging',    'seed: schooling, no rider', 4),
    (v_stable_id, v_h_bella,  v_c_anna,    v_owner_id, v_now - interval '8 days',  45, 'flat',       'seed: trot work', 3),
    (v_stable_id, v_h_finn,   v_c_marija,  v_owner_id, v_now - interval '7 days',  60, 'flat',       'seed: progressing nicely', 4),
    (v_stable_id, v_h_storm,  v_c_petras,  v_owner_id, v_now - interval '6 days',  60, 'flat',       'seed:', 4),
    (v_stable_id, v_h_atlas,  null,        v_owner_id, v_now - interval '6 days',  30, 'groundwork', 'seed: leading practice', null),
    (v_stable_id, v_h_apollo, v_c_marta,   v_owner_id, v_now - interval '5 days',  75, 'jumping',    'seed: gridwork', 5),
    (v_stable_id, v_h_dakota, null,        v_owner_id, v_now - interval '5 days',  30, 'lunging',    'seed: building topline', 3),
    (v_stable_id, v_h_oscar,  v_c_lina,    v_owner_id, v_now - interval '4 days',  90, 'hack',       'seed: long hack with two horses', 5),
    (v_stable_id, v_h_zorba,  v_c_sophie,  v_owner_id, v_now - interval '4 days',  60, 'flat',       'seed:', 5),
    (v_stable_id, v_h_ivy,    null,        v_owner_id, v_now - interval '3 days',  30, 'lunging',    'seed: slow + steady', 4),
    (v_stable_id, v_h_nova,   v_c_dovile,  v_owner_id, v_now - interval '3 days',  60, 'jumping',    'seed: 1m course', 4),
    (v_stable_id, v_h_storm,  v_c_petras,  v_owner_id, v_now - interval '2 days',  60, 'flat',       'seed: lovely session', 5),
    (v_stable_id, v_h_apollo, v_c_marta,   v_owner_id, v_now - interval '2 days',  60, 'jumping',    'seed:', 4),
    (v_stable_id, v_h_finn,   null,        v_owner_id, v_now - interval '1 days',  30, 'lunging',    'seed:', 3),
    (v_stable_id, v_h_bella,  v_c_anna,    v_owner_id, v_now - interval '1 days',  45, 'flat',       'seed:', 4),
    (v_stable_id, v_h_atlas,  null,        v_owner_id, v_now - interval '1 days',  60, 'flat',       'seed: rider Andreja schooling', 4),
    (v_stable_id, v_h_dakota, null,        v_owner_id, v_now - interval '8 hours', 30, 'lunging',    'seed: today early', 3),
    (v_stable_id, v_h_zorba,  v_c_sophie,  v_owner_id, v_now - interval '6 hours', 60, 'flat',       'seed: today', 5),
    (v_stable_id, v_h_oscar,  null,        v_owner_id, v_now - interval '4 hours', 45, 'flat',       'seed: schooling for Lina', 4),
    (v_stable_id, v_h_rosie,  v_c_simona,  v_owner_id, v_now - interval '2 hours', 30, 'flat',       'seed: today, kid lesson', 5),
    (v_stable_id, v_h_storm,  v_c_petras,  v_owner_id, v_now - interval '1 hour',  45, 'flat',       'seed: today',  4);

  -- =========================================================
  -- HORSE BOARDING CHARGES (3 boarders × past 2 months + this month)
  -- =========================================================
  insert into horse_boarding_charges (stable_id, horse_id, owner_client_id, period_start, period_end, period_label, amount, notes) values
    (v_stable_id, v_h_storm, v_c_petras, date_trunc('month', v_today - interval '2 months')::date, (date_trunc('month', v_today - interval '2 months') + interval '1 month - 1 day')::date, 'Boarding · ' || to_char(v_today - interval '2 months', 'Mon YYYY'), 380, 'seed:'),
    (v_stable_id, v_h_storm, v_c_petras, date_trunc('month', v_today - interval '1 month')::date,  (date_trunc('month', v_today - interval '1 month')  + interval '1 month - 1 day')::date, 'Boarding · ' || to_char(v_today - interval '1 month', 'Mon YYYY'),  380, 'seed:'),
    (v_stable_id, v_h_storm, v_c_petras, date_trunc('month', v_today)::date,                       (date_trunc('month', v_today) + interval '1 month - 1 day')::date,                       'Boarding · ' || to_char(v_today, 'Mon YYYY'),                          380, 'seed:'),
    (v_stable_id, v_h_nova,  v_c_dovile, date_trunc('month', v_today - interval '2 months')::date, (date_trunc('month', v_today - interval '2 months') + interval '1 month - 1 day')::date, 'Boarding · ' || to_char(v_today - interval '2 months', 'Mon YYYY'), 320, 'seed:'),
    (v_stable_id, v_h_nova,  v_c_dovile, date_trunc('month', v_today - interval '1 month')::date,  (date_trunc('month', v_today - interval '1 month')  + interval '1 month - 1 day')::date, 'Boarding · ' || to_char(v_today - interval '1 month', 'Mon YYYY'),  320, 'seed:'),
    (v_stable_id, v_h_nova,  v_c_dovile, date_trunc('month', v_today)::date,                       (date_trunc('month', v_today) + interval '1 month - 1 day')::date,                       'Boarding · ' || to_char(v_today, 'Mon YYYY'),                          320, 'seed:'),
    (v_stable_id, v_h_oscar, v_c_lina,   date_trunc('month', v_today - interval '1 month')::date,  (date_trunc('month', v_today - interval '1 month')  + interval '1 month - 1 day')::date, 'Boarding · ' || to_char(v_today - interval '1 month', 'Mon YYYY'),  320, 'seed:'),
    (v_stable_id, v_h_oscar, v_c_lina,   date_trunc('month', v_today)::date,                       (date_trunc('month', v_today) + interval '1 month - 1 day')::date,                       'Boarding · ' || to_char(v_today, 'Mon YYYY'),                          320, 'seed:');

  -- =========================================================
  -- MISC CLIENT CHARGES (6)
  -- =========================================================
  insert into client_charges (stable_id, client_id, horse_id, kind, amount, incurred_on, notes) values
    (v_stable_id, v_c_petras, v_h_storm, 'farrier',        65, v_today - interval '12 days', 'seed: full set'),
    (v_stable_id, v_c_dovile, v_h_nova,  'farrier',        65, v_today - interval '8 days',  'seed: full set'),
    (v_stable_id, v_c_lina,   v_h_oscar, 'vet_copay',     120, v_today - interval '15 days', 'seed: lameness check'),
    (v_stable_id, v_c_petras, v_h_storm, 'equipment',      45, v_today - interval '5 days',  'seed: replacement bridle'),
    (v_stable_id, v_c_dovile, v_h_nova,  'transport',     150, v_today - interval '20 days', 'seed: show transport to LSF'),
    (v_stable_id, v_c_lina,   v_h_oscar, 'training_extra', 80, v_today - interval '3 days',  'seed: extra schooling rides');

  -- =========================================================
  -- PAYMENTS (25 — covers most past lessons + some boarding)
  -- =========================================================
  insert into payments (stable_id, client_id, lesson_id, amount, method, paid_at, notes, package_id) values
    (v_stable_id, v_c_anna,   null, 240.00, 'transfer', v_now - interval '20 days', 'seed: 10-pack purchase',  v_pkg_anna),
    (v_stable_id, v_c_lukas,  null, 300.00, 'card',     v_now - interval '40 days', 'seed: 12-pack purchase',  v_pkg_lukas),
    (v_stable_id, v_c_emma,   null, 240.00, 'transfer', v_now - interval '10 days', 'seed: dressage 8-pack',   v_pkg_emma),
    (v_stable_id, v_c_klara,  null, 300.00, 'cash',     v_now - interval '60 days', 'seed: 10-pack purchase',  v_pkg_klara),
    (v_stable_id, v_c_marta,  null,  35.00, 'cash',     v_now - interval '12 days', 'seed: jumping lesson',     null),
    (v_stable_id, v_c_jonas,  null,  25.00, 'cash',     v_now - interval '12 days', 'seed: beginner lesson',    null),
    (v_stable_id, v_c_simona, null,  18.00, 'cash',     v_now - interval '11 days', 'seed: kid lesson Rosie',   null),
    (v_stable_id, v_c_petras, null, 380.00, 'transfer', v_now - interval '8 days',  'seed: boarding payment',   null),
    (v_stable_id, v_c_petras, null,  65.00, 'cash',     v_now - interval '8 days',  'seed: farrier reimburs.',  null),
    (v_stable_id, v_c_dovile, null, 320.00, 'transfer', v_now - interval '7 days',  'seed: boarding payment',   null),
    (v_stable_id, v_c_lina,   null, 320.00, 'transfer', v_now - interval '5 days',  'seed: boarding partial',   null),
    (v_stable_id, v_c_marta,  null,  35.00, 'card',     v_now - interval '7 days',  'seed: jumping lesson',     null),
    (v_stable_id, v_c_marija, null,  30.00, 'cash',     v_now - interval '8 days',  'seed: lesson Finn',        null),
    (v_stable_id, v_c_lea,    null,  25.00, 'cash',     v_now - interval '7 days',  'seed:',                    null),
    (v_stable_id, v_c_oliver, null,  45.00, 'transfer', v_now - interval '2 days',  'seed: pro clinic ride',    null),
    (v_stable_id, v_c_sophie, null,  45.00, 'transfer', v_now - interval '1 day',   'seed: pro session',        null),
    (v_stable_id, v_c_julia,  null,  50.00, 'cash',     v_now - interval '15 days', 'seed: deposit',            null),
    (v_stable_id, v_c_eva,    null, 100.00, 'transfer', v_now - interval '10 days', 'seed: account top-up',     null),
    (v_stable_id, v_c_paul,   null,  80.00, 'card',     v_now - interval '5 days',  'seed: hack pre-payment',   null),
    (v_stable_id, v_c_egle,   null,  60.00, 'cash',     v_now - interval '20 days', 'seed: 2-lesson deposit',   null),
    (v_stable_id, v_c_petras, null, 380.00, 'transfer', v_now - interval '40 days', 'seed: boarding 2 mo ago',  null),
    (v_stable_id, v_c_dovile, null, 320.00, 'transfer', v_now - interval '40 days', 'seed: boarding 2 mo ago',  null),
    (v_stable_id, v_c_anna,   null,  10.00, 'cash',     v_now - interval '3 days',  'seed: tip',                null),
    (v_stable_id, v_c_klara,  null,  30.00, 'cash',     v_now - interval '15 days', 'seed: extra lesson',       null),
    (v_stable_id, v_c_lukas,  null,  20.00, 'cash',     v_now - interval '5 days',  'seed: helmet rental',      null);

  -- =========================================================
  -- EXPENSES (15)
  -- =========================================================
  insert into expenses (stable_id, category, amount, description, horse_id, incurred_on, created_by) values
    (v_stable_id, 'feed',        850, 'seed: hay delivery (10 bales)', null,        v_today - interval '25 days', v_owner_id),
    (v_stable_id, 'feed',        420, 'seed: oats + chaff',            null,        v_today - interval '20 days', v_owner_id),
    (v_stable_id, 'feed',        180, 'seed: supplements (vit/min)',   null,        v_today - interval '15 days', v_owner_id),
    (v_stable_id, 'vet',         320, 'seed: routine check-up + bloods', v_h_apollo, v_today - interval '18 days', v_owner_id),
    (v_stable_id, 'vet',         180, 'seed: lameness exam',           v_h_oscar,   v_today - interval '15 days', v_owner_id),
    (v_stable_id, 'vet',          90, 'seed: dental float',            v_h_zorba,   v_today - interval '8 days',  v_owner_id),
    (v_stable_id, 'farrier',     180, 'seed: shoe set × 3 horses',     null,        v_today - interval '12 days', v_owner_id),
    (v_stable_id, 'farrier',     130, 'seed: trim + 2 shoes',          v_h_storm,   v_today - interval '12 days', v_owner_id),
    (v_stable_id, 'farrier',     120, 'seed: trim × 6',                null,        v_today - interval '5 days',  v_owner_id),
    (v_stable_id, 'maintenance', 240, 'seed: arena footing top-up',    null,        v_today - interval '22 days', v_owner_id),
    (v_stable_id, 'maintenance', 180, 'seed: fence repair + paint',    null,        v_today - interval '10 days', v_owner_id),
    (v_stable_id, 'maintenance', 350, 'seed: water trough replacement',null,        v_today - interval '4 days',  v_owner_id),
    (v_stable_id, 'staff',       400, 'seed: weekend help',            null,        v_today - interval '16 days', v_owner_id),
    (v_stable_id, 'staff',       400, 'seed: weekend help',            null,        v_today - interval '2 days',  v_owner_id),
    (v_stable_id, 'other',        85, 'seed: insurance copay',         null,        v_today - interval '7 days',  v_owner_id);

  -- =========================================================
  -- HEALTH RECORDS (8 — including 2 OVERDUE so Smart Suggestions lights up)
  -- =========================================================
  insert into horse_health_records (stable_id, horse_id, kind, occurred_on, next_due_on, title, notes, created_by) values
    (v_stable_id, v_h_apollo, 'vaccination', v_today - interval '11 months 20 days', v_today - interval '20 days',  'Annual EHV booster',           'seed: OVERDUE — vet visit pending', v_owner_id),
    (v_stable_id, v_h_atlas,  'farrier',     v_today - interval '8 weeks',           v_today - interval '5 days',   'Trim + reshoeing',             'seed: OVERDUE — slipped 1 wk',      v_owner_id),
    (v_stable_id, v_h_bella,  'vaccination', v_today - interval '11 months',         v_today + interval '30 days',  'Annual EHV booster',           'seed: due in 30 days',              v_owner_id),
    (v_stable_id, v_h_storm,  'vaccination', v_today - interval '8 months',          v_today + interval '4 months', 'EHV-1 booster',                'seed:',                              v_owner_id),
    (v_stable_id, v_h_storm,  'farrier',     v_today - interval '6 weeks',           v_today + interval '8 days',   'Trim + new front shoes',       'seed: due soon',                     v_owner_id),
    (v_stable_id, v_h_nova,   'vaccination', v_today - interval '6 months',          v_today + interval '6 months', 'Tetanus + EHV combo',          'seed:',                              v_owner_id),
    (v_stable_id, v_h_oscar,  'vet',         v_today - interval '15 days',           v_today + interval '15 days',  'Lameness re-check',            'seed: follow-up visit due',          v_owner_id),
    (v_stable_id, v_h_zorba,  'farrier',     v_today - interval '4 weeks',           v_today + interval '4 weeks',  'Routine trim',                 'seed:',                              v_owner_id);

  -- =========================================================
  -- REMINDERS (5)
  -- =========================================================
  insert into reminders (stable_id, created_by, assigned_to, body, due_at, completed_at) values
    (v_stable_id, v_owner_id, v_owner_id, 'Order more wood shavings — running low', v_today + interval '2 days',  null),
    (v_stable_id, v_owner_id, v_owner_id, 'Pay vet invoice for Apollo bloodwork',   v_today + interval '5 days',  null),
    (v_stable_id, v_owner_id, v_owner_id, 'Confirm Sophie''s pro clinic next month',v_today + interval '8 days',  null),
    (v_stable_id, v_owner_id, v_owner_id, 'Reply to Lina about Oscar transport',    v_today,                       null),
    (v_stable_id, v_owner_id, v_owner_id, 'Buy new lunge whip',                     v_today - interval '5 days',  v_now - interval '4 days');

  -- =========================================================
  -- CLIENT AGREEMENTS (3)
  -- =========================================================
  insert into client_agreements (stable_id, client_id, kind, signed_at, required_for_boarders, notes) values
    (v_stable_id, v_c_petras, 'liability_waiver', v_today - interval '180 days', true,  'seed:'),
    (v_stable_id, v_c_dovile, 'liability_waiver', v_today - interval '120 days', true,  'seed:'),
    (v_stable_id, v_c_lina,   'liability_waiver', v_today - interval '90 days',  true,  'seed:');

  raise notice 'Seed complete. Stable %, horses 12, clients 20, lessons ~40, sessions 25.', v_stable_id;
end $seed$;

-- =============================================================
-- DONE.
--
-- To CLEAN UP later (remove all seed data):
--
--   delete from sessions               where notes like 'seed:%';
--   delete from horse_health_records   where notes like 'seed:%';
--   delete from reminders              where body  in ('Order more wood shavings — running low','Pay vet invoice for Apollo bloodwork','Confirm Sophie''s pro clinic next month','Reply to Lina about Oscar transport','Buy new lunge whip');
--   delete from client_agreements      where notes like 'seed:%';
--   delete from client_charges         where notes like 'seed:%';
--   delete from horse_boarding_charges where notes like 'seed:%';
--   delete from payments               where notes like 'seed:%';
--   delete from expenses               where description like 'seed:%';
--   delete from lessons                where notes like 'seed:%';
--   delete from lesson_packages        where notes like 'seed:%';
--   delete from services               where stable_id in (select id from stables) and name in ('Beginner — 30 min','Beginner — 45 min','Intermediate — 60 min','Show jumping — 60 min','Lunge lesson — 30 min','Hack — 90 min');
--   delete from clients                where notes like 'seed:%';
--   delete from horses                 where notes like 'seed:%';
-- =============================================================
