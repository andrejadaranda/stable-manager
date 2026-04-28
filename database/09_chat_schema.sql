-- =============================================================
-- 09_chat_schema.sql
-- Chat module: tables, indexes, same-stable triggers, updated_at
-- bump trigger, general-thread auto-creation, realtime publication.
--
-- Strict tenant isolation: every chat row carries stable_id.
-- All cross-FKs are validated by triggers (defense-in-depth) so
-- even a successful RLS bypass elsewhere cannot smuggle a row
-- into the wrong stable.
--
-- RLS policies live in 10_chat_policies.sql.
-- Permission helpers + RPCs live in 11_chat_functions.sql.
-- =============================================================

-- ---------------- ENUM ----------------
create type chat_thread_type as enum ('stable_general', 'direct');

-- ---------------- THREADS ----------------
create table chat_threads (
  id          uuid primary key default gen_random_uuid(),
  stable_id   uuid not null references stables(id) on delete cascade,
  type        chat_thread_type not null,
  title       text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Exactly one general thread per stable.
create unique index chat_threads_one_general_per_stable
  on chat_threads(stable_id)
  where type = 'stable_general';

-- Drives the conversation list sort (recent activity first).
create index chat_threads_stable_type_updated
  on chat_threads(stable_id, type, updated_at desc);

-- ---------------- PARTICIPANTS ----------------
-- For 'direct' threads: rows are REQUIRED and gate visibility.
-- For 'stable_general' threads: rows are OPTIONAL — visibility is
-- implicit via stable membership; rows exist only to track
-- last_read_at for the unread badge (lazy upsert).
create table chat_participants (
  id            uuid primary key default gen_random_uuid(),
  stable_id     uuid not null references stables(id)      on delete cascade,
  thread_id     uuid not null references chat_threads(id) on delete cascade,
  profile_id    uuid not null references profiles(id)     on delete cascade,
  role_at_join  user_role not null,
  last_read_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (thread_id, profile_id)
);
create index chat_participants_profile_thread on chat_participants(profile_id, thread_id);
create index chat_participants_stable_profile on chat_participants(stable_id, profile_id);

-- ---------------- MESSAGES ----------------
create table chat_messages (
  id                 uuid primary key default gen_random_uuid(),
  stable_id          uuid not null references stables(id)      on delete cascade,
  thread_id          uuid not null references chat_threads(id) on delete cascade,
  sender_profile_id  uuid not null references profiles(id)     on delete restrict,
  body               text not null,
  created_at         timestamptz not null default now(),
  edited_at          timestamptz,        -- reserved; no UPDATE policy in MVP
  deleted_at         timestamptz,        -- reserved; no DELETE policy in MVP
  constraint chat_messages_body_length check (length(body) between 1 and 4000)
);
create index chat_messages_thread_created on chat_messages(thread_id, created_at desc);
create index chat_messages_stable_created on chat_messages(stable_id, created_at desc);

-- =============================================================
-- updated_at touch trigger on chat_threads
-- =============================================================
create trigger trg_chat_threads_updated
  before update on chat_threads
  for each row execute function set_updated_at();

-- =============================================================
-- SAME-STABLE VALIDATION TRIGGERS
-- Defense-in-depth: every cross-FK must point inside the same
-- stable as the parent row. Triggers run as INVOKER so RLS still
-- applies — a malicious caller cannot reference rows they cannot
-- already see.
-- =============================================================

-- chat_participants: thread + profile must share stable_id with row.
create or replace function chat_participants_enforce_same_stable() returns trigger
language plpgsql as $$
declare t_stable uuid; p_stable uuid;
begin
  select stable_id into t_stable from chat_threads where id = new.thread_id;
  select stable_id into p_stable from profiles      where id = new.profile_id;
  if t_stable is null or t_stable <> new.stable_id then
    raise exception 'chat thread % does not belong to stable %', new.thread_id, new.stable_id; end if;
  if p_stable is null or p_stable <> new.stable_id then
    raise exception 'profile % does not belong to stable %', new.profile_id, new.stable_id; end if;
  return new;
end $$;

create trigger chat_participants_same_stable
  before insert or update on chat_participants
  for each row execute function chat_participants_enforce_same_stable();

-- chat_messages: thread + sender must share stable_id with row.
create or replace function chat_messages_enforce_same_stable() returns trigger
language plpgsql as $$
declare t_stable uuid; s_stable uuid;
begin
  select stable_id into t_stable from chat_threads where id = new.thread_id;
  select stable_id into s_stable from profiles      where id = new.sender_profile_id;
  if t_stable is null or t_stable <> new.stable_id then
    raise exception 'chat thread % does not belong to stable %', new.thread_id, new.stable_id; end if;
  if s_stable is null or s_stable <> new.stable_id then
    raise exception 'sender % does not belong to stable %', new.sender_profile_id, new.stable_id; end if;
  return new;
end $$;

create trigger chat_messages_same_stable
  before insert or update on chat_messages
  for each row execute function chat_messages_enforce_same_stable();

-- =============================================================
-- Bump chat_threads.updated_at when a new message arrives.
-- Drives the conversation list ordering.
-- =============================================================
create or replace function chat_messages_touch_thread() returns trigger
language plpgsql as $$
begin
  update chat_threads set updated_at = greatest(updated_at, new.created_at)
   where id = new.thread_id;
  return new;
end $$;

create trigger chat_messages_bump_thread
  after insert on chat_messages
  for each row execute function chat_messages_touch_thread();

-- =============================================================
-- Auto-create the single 'stable_general' thread when a stable
-- is provisioned. We do NOT touch 06_auth.sql / provision_stable;
-- a trigger keeps existing migrations untouched.
-- =============================================================
create or replace function stables_create_general_chat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into chat_threads(stable_id, type, title)
    values (new.id, 'stable_general', 'General')
    on conflict do nothing;
  return new;
end $$;

create trigger stables_create_general_chat_trg
  after insert on stables
  for each row execute function stables_create_general_chat();

-- Backfill: ensure every existing stable has its general thread.
insert into chat_threads(stable_id, type, title)
select s.id, 'stable_general', 'General'
  from stables s
 where not exists (
   select 1 from chat_threads t
    where t.stable_id = s.id and t.type = 'stable_general'
 );

-- =============================================================
-- Grants — base table privileges. RLS does the real gating.
-- Without these grants, even RLS-allowed rows are invisible to
-- the `authenticated` role.
-- =============================================================
grant select, insert, update on chat_threads      to authenticated;
grant select, insert, update on chat_participants to authenticated;
grant select, insert         on chat_messages     to authenticated;

-- =============================================================
-- REALTIME PUBLICATION
-- Only chat_messages broadcasts. Threads/participants are fetched
-- via the service layer when a message arrives. Realtime v2
-- evaluates RLS per row before delivery, so cross-stable leaks
-- are impossible.
--
-- Required Supabase setup: nothing additional in the dashboard.
-- Verify post-deploy: Database -> Replication -> chat_messages
-- listed under publication `supabase_realtime`.
-- =============================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- ALTER PUBLICATION ... ADD TABLE has no IF NOT EXISTS, so we guard.
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'chat_messages'
    ) then
      execute 'alter publication supabase_realtime add table chat_messages';
    end if;
  end if;
end $$;
