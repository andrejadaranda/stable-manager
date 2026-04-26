-- =============================================================
-- 01_extensions.sql
-- Required Postgres extensions, installed in Supabase's standard
-- `extensions` schema (not `public`) so pg_dump/pg_restore stay clean.
-- =============================================================

create extension if not exists pgcrypto   with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- pgcrypto provides gen_random_uuid().
-- btree_gist enables exclusion constraints that mix uuid + tstzrange,
-- which is how we prevent horse and trainer double-booking on `lessons`.
