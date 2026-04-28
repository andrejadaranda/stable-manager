-- =============================================================
-- 18_sessions_force_rls.sql
-- Defense-in-depth alignment: 04_policies.sql forces RLS on every
-- tenant table. 13_sessions_policies.sql only enabled it. Force it,
-- so even a future service-role script in this codebase cannot
-- bypass the sessions tenant isolation.
-- =============================================================

alter table sessions force row level security;
