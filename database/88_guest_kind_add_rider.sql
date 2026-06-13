-- =============================================================
-- 88_guest_kind_add_rider.sql
-- Co-rider sharing: a horse owner can let someone ride their horse and log
-- the ride via a magic link, no account. Add the 'rider' guest kind (must be
-- committed before use); the RPC + policies land in migration 89.
-- =============================================================
alter type guest_contributor_kind add value if not exists 'rider';
