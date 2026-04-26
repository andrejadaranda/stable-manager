-- =============================================================
-- 99_cleanup.sql
-- Removes all seed data so you can re-run the test plan from
-- a clean slate. Runs as the default `postgres` role (BYPASSRLS).
-- =============================================================
delete from expenses where stable_id in (select id from stables where slug in ('stable-alpha','stable-bravo'));
delete from payments where stable_id in (select id from stables where slug in ('stable-alpha','stable-bravo'));
delete from lessons  where stable_id in (select id from stables where slug in ('stable-alpha','stable-bravo'));
delete from clients  where stable_id in (select id from stables where slug in ('stable-alpha','stable-bravo'));
delete from horses   where stable_id in (select id from stables where slug in ('stable-alpha','stable-bravo'));
delete from profiles where stable_id in (select id from stables where slug in ('stable-alpha','stable-bravo'));
delete from stables  where slug in ('stable-alpha','stable-bravo');
delete from auth.users where email like '%@test.local';
