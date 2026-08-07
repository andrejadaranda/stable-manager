-- =============================================================
-- 112_personal_social_and_goals.sql
--
-- Two additions to the private command centre:
--   1. Publishing to social media from the dashboard (compose, schedule,
--      multi-platform push, media storage).
--   2. Wider goal tracking — weekly periods, new trackable metrics, and
--      an audience-size series so "Instagram +100 followers" is a goal
--      that can actually be measured.
--
-- Depends on 110 (dashboard_is_allowed, set_updated_at) and 111.
-- Additive and idempotent, like everything before it. Teardown at the
-- bottom.
--
-- NAMING NOTE, worth reading before you grep:
-- `dashboard_social_posts` (migration 110) is the READ cache — metrics
-- fetched back from Meta about posts that already exist. This migration
-- adds `dashboard_social_queue`, the WRITE side — things she has composed
-- and wants published. They are deliberately separate tables: one is
-- disposable cache that can be truncated and refetched at any time, the
-- other contains the only copy of a draft she has written. Merging them
-- would put those two lifecycles in one row.
-- =============================================================

-- -------------------------------------------------------------
-- 1. THE COMPOSE / SCHEDULE QUEUE
-- -------------------------------------------------------------
create table if not exists dashboard_social_queue (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid not null references auth.users(id) on delete cascade,

  -- Which platforms this one piece of content goes to. An array rather
  -- than a row per platform: she writes once and pushes to several, and
  -- keeping it as one row is what makes "edit the draft" mean editing
  -- one thing instead of reconciling three.
  -- 'instagram_feed' | 'instagram_story' | 'facebook_page'
  platforms      text[] not null default '{}',

  content        text not null default '',

  -- [{ url, path, type: 'image'|'video', width, height }]
  -- `url` is the public Supabase Storage URL. Meta's publishing API
  -- fetches the media from that URL itself — it does not accept an
  -- upload — which is why the bucket below has to be public-read.
  media          jsonb not null default '[]'::jsonb,

  -- draft      → saved, not going anywhere
  -- scheduled  → will publish at scheduled_for
  -- publishing → a worker has claimed it (guards against double-send)
  -- published  → every target platform succeeded
  -- partial    → some platforms succeeded, some failed
  -- failed     → nothing succeeded
  status         text not null default 'draft'
                   check (status in ('draft','scheduled','publishing','published','partial','failed')),

  scheduled_for  timestamptz,
  published_at   timestamptz,

  -- { instagram_feed: "17901234...", facebook_page: "1234_5678" }
  -- Keyed by platform so a retry can skip the ones that already landed.
  -- This is what makes retrying safe rather than a way to double-post.
  external_ids   jsonb not null default '{}'::jsonb,

  -- { facebook_page: "(#200) requires pages_manage_posts" }
  last_errors    jsonb not null default '{}'::jsonb,

  attempts       int not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- A scheduled post with no time would sit in the queue forever.
  constraint dashboard_social_queue_scheduled_needs_time
    check (status <> 'scheduled' or scheduled_for is not null)
);

-- The publisher's hot path: "anything due, not yet claimed".
create index if not exists dashboard_social_queue_due
  on dashboard_social_queue (status, scheduled_for)
  where status in ('scheduled', 'publishing');

create index if not exists dashboard_social_queue_recent
  on dashboard_social_queue (auth_user_id, created_at desc);

drop trigger if exists trg_dashboard_social_queue_updated on dashboard_social_queue;
create trigger trg_dashboard_social_queue_updated
  before update on dashboard_social_queue
  for each row execute function set_updated_at();

alter table dashboard_social_queue enable row level security;
alter table dashboard_social_queue force  row level security;
drop policy if exists dashboard_social_queue_own on dashboard_social_queue;
create policy dashboard_social_queue_own on dashboard_social_queue
  for all
  using      (auth_user_id = auth.uid() and dashboard_is_allowed())
  with check (auth_user_id = auth.uid() and dashboard_is_allowed());

-- -------------------------------------------------------------
-- 2. MEDIA BUCKET
-- -------------------------------------------------------------
-- Public-read is a requirement, not a shortcut: Instagram's Content
-- Publishing API takes an `image_url` and fetches it from Meta's own
-- servers, with no credentials. A signed URL would work only until it
-- expired, and Meta re-fetches media on its own schedule.
--
-- The exposure is bounded and acceptable: the only things in this bucket
-- are images she is about to publish publicly anyway. Filenames are
-- UUIDs, so the bucket is not enumerable.
-- WHY THIS WHOLE SECTION IS WRAPPED IN AN EXCEPTION HANDLER
--
-- On some Supabase projects `storage.objects` is owned by
-- `supabase_storage_admin` rather than `postgres`, and CREATE POLICY on
-- it raises insufficient_privilege. Because this migration is applied
-- inside a single transaction, an unhandled error here would roll back
-- migrations 110 and 111 as well — the entire dashboard, defeated by an
-- image bucket.
--
-- So a failure is caught and reported as a NOTICE. Everything except
-- attaching media to a post still works, and the fix is one click in the
-- Storage UI (New bucket → personal-social → Public).
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'personal-social',
    'personal-social',
    true,
    104857600, -- 100 MB, comfortably above an Instagram video
    array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']
  )
  on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- WRITING to the bucket stays locked to allowlisted operators, and each
  -- of them only inside a folder named after their own user id.
  execute 'drop policy if exists personal_social_media_own on storage.objects';
  execute $p$
    create policy personal_social_media_own on storage.objects
      for all
      to authenticated
      using (
        bucket_id = 'personal-social'
        and dashboard_is_allowed()
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'personal-social'
        and dashboard_is_allowed()
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  raise notice 'personal-social storage bucket ready.';
exception
  when insufficient_privilege or undefined_table then
    raise notice
      'Could not configure the personal-social storage bucket (%). Everything else applied. Create it by hand: Storage -> New bucket -> name "personal-social" -> Public. Composing posts works; attaching photos will not until then.',
      sqlerrm;
end $$;

-- -------------------------------------------------------------
-- 3. AUDIENCE SNAPSHOTS  (follower-growth goals)
-- -------------------------------------------------------------
-- "Instagram +100 followers this month" needs a baseline, and Meta's API
-- only ever reports the CURRENT follower count. So it is sampled daily
-- and the goal is measured as (today − first sample of the period).
--
-- One row per platform per day: re-sampling on the same day overwrites
-- rather than accumulating.
create table if not exists dashboard_audience_snapshots (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  platform      text not null check (platform in ('instagram','facebook')),
  captured_on   date not null,
  followers     int not null default 0,
  posts_count   int not null default 0,
  created_at    timestamptz not null default now(),
  unique (auth_user_id, platform, captured_on)
);

create index if not exists dashboard_audience_recent
  on dashboard_audience_snapshots (auth_user_id, platform, captured_on desc);

alter table dashboard_audience_snapshots enable row level security;
alter table dashboard_audience_snapshots force  row level security;
drop policy if exists dashboard_audience_snapshots_own on dashboard_audience_snapshots;
create policy dashboard_audience_snapshots_own on dashboard_audience_snapshots
  for all
  using      (auth_user_id = auth.uid() and dashboard_is_allowed())
  with check (auth_user_id = auth.uid() and dashboard_is_allowed());

-- -------------------------------------------------------------
-- 4. GOALS — weekly periods
-- -------------------------------------------------------------
-- Migration 110 allowed 'month' and 'quarter'. A weekly lesson target
-- ("20 pamokų per savaitę") is one of the things she actually tracks, and
-- a month is too coarse to act on mid-week.
--
-- The constraint is dropped by its auto-generated name. `if exists`
-- makes this safe on a database where it was already replaced.
alter table dashboard_goals
  drop constraint if exists dashboard_goals_period_check;
alter table dashboard_goals
  add constraint dashboard_goals_period_check
  check (period in ('week', 'month', 'quarter'));

-- Grouping for the UI ('tjk' | 'longrein' | 'rinkodara'). Nullable and
-- untyped on purpose: it drives which heading a card sits under, and a
-- new grouping should not need a migration.
alter table dashboard_goals
  add column if not exists category text;

comment on table dashboard_social_queue is
  'Compose/schedule queue for social publishing. The WRITE side — dashboard_social_posts is the metrics read cache.';
comment on table dashboard_audience_snapshots is
  'Daily follower-count samples. Meta only reports the current count, so growth goals need a stored baseline.';

-- -------------------------------------------------------------
-- 5. TEARDOWN  (the "down" for this migration)
-- -------------------------------------------------------------
--   drop table if exists dashboard_social_queue;
--   drop table if exists dashboard_audience_snapshots;
--   drop policy if exists personal_social_media_own on storage.objects;
--   delete from storage.objects where bucket_id = 'personal-social';
--   delete from storage.buckets where id = 'personal-social';
--   alter table dashboard_goals drop column if exists category;
--   alter table dashboard_goals drop constraint if exists dashboard_goals_period_check;
--   alter table dashboard_goals add constraint dashboard_goals_period_check
--     check (period in ('month', 'quarter'));
--
-- Note the last two lines: reverting the period constraint will FAIL if
-- any weekly goals exist. Delete them first:
--   delete from dashboard_goals where period = 'week';
