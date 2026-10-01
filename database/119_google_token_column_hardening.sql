-- =============================================================
-- 119_google_token_column_hardening.sql
--
-- Defense in depth for Google tokens. RLS already limits a connection row
-- to its owner, but that still lets the owner's BROWSER session (the
-- `authenticated` role, anon key) read the refresh token with select('*').
-- We never want a refresh token to reach the client, so revoke column-level
-- SELECT/UPDATE on the secret columns from authenticated + anon. The
-- service-role client (used by lib/google + services/googleCalendar) bypasses
-- these grants, so server-side token handling still works.
--
-- After this, UI/service code MUST select explicit non-secret columns
-- (which it does) — a `select *` as the authenticated role would error.
-- Applied to live DB dluxzjphpokzkrwmmibe. Idempotent-ish (REVOKE is safe to
-- re-run).
-- =============================================================

revoke select (access_token, refresh_token) on google_calendar_connections from authenticated;
revoke select (access_token, refresh_token) on google_calendar_connections from anon;
revoke update (access_token, refresh_token) on google_calendar_connections from authenticated;
revoke update (access_token, refresh_token) on google_calendar_connections from anon;
