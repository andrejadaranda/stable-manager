-- 117_client_reactivation_dismissed.sql
-- "Don't show in the lapsed / reactivation list" flag. When the owner dismisses
-- a client from the "haven't been in for 2+ weeks" list (e.g. one-off tourists
-- who won't return), we stamp this; the lapsed filter and the Overview nudge
-- both skip stamped clients. Clearing it (or the client booking again) brings
-- them back naturally. Applied to live DB dluxzjphpokzkrwmmibe.
alter table clients add column if not exists reactivation_dismissed_at timestamptz;
