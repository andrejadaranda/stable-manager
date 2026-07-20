-- 103_calendar_feed_tokens.sql
-- Secret per-user iCalendar feed tokens. The token is the credential for the
-- read-only /api/calendar/<token>.ics subscription feed (standard for calendar
-- subscriptions). Rotate by setting the column to gen_random_uuid().
-- Applied to live DB dluxzjphpokzkrwmmibe 2026-07-19.

alter table profiles add column if not exists calendar_token uuid unique default gen_random_uuid();
alter table clients  add column if not exists calendar_token uuid unique default gen_random_uuid();

update profiles set calendar_token = gen_random_uuid() where calendar_token is null;
update clients  set calendar_token = gen_random_uuid() where calendar_token is null;

create index if not exists profiles_calendar_token_idx on profiles(calendar_token);
create index if not exists clients_calendar_token_idx  on clients(calendar_token);
