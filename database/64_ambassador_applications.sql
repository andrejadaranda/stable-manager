-- =============================================================
-- 64_ambassador_applications.sql
--
-- Public capture for the Longrein Ambassador Program application
-- form at longrein.eu/ambassador-application.
--
-- Privacy (mirrors 31_waitlist_signups):
--   * Anyone (anon) can INSERT a single application.
--   * No one but the service role can SELECT — applicant data never
--     leaks via the anon Supabase client. The Longrein team reads via
--     the SQL editor (or the future admin dashboard / owner read policy).
--
-- Anti-spam: honeypot + validation handled in the API route
-- (/app/api/ambassador). DB enforces minimal sanity only.
--
-- This is the intake table. The functional referral engine
-- (ambassadors, referrals, tiers, commissions, Stripe attribution)
-- is a separate, later migration — see Ambassador_Setup_Instructions.md.
-- =============================================================

create table if not exists ambassador_applications (
  id               uuid primary key default gen_random_uuid(),
  -- Personal
  full_name        text not null,
  email            text not null,
  country          text,
  -- Equestrian background
  horses           text,
  discipline       text,
  describes        text,           -- multi-select, "; "-joined
  -- Social
  instagram        text,
  tiktok           text,
  facebook         text,
  youtube          text,
  other_links      text,
  audience         text,
  -- Community
  community_type   text,
  community_size   text,
  -- Program
  support          text,           -- multi-select, "; "-joined
  invite_count     text,
  notes_applicant  text,
  agreement        boolean not null default false,
  -- Ops
  status           text not null default 'new',   -- new | approved | rejected
  admin_notes      text,
  source_page      text,
  ip               text,
  user_agent       text,
  created_at       timestamptz not null default now()
);

create index if not exists ambassador_applications_created_idx on ambassador_applications (created_at desc);
create index if not exists ambassador_applications_status_idx  on ambassador_applications (status);
create index if not exists ambassador_applications_email_idx   on ambassador_applications (lower(email));

-- ---------------- RLS ----------------
alter table ambassador_applications enable row level security;
alter table ambassador_applications force  row level security;

-- Anyone can submit one application. Read/update is service-role only
-- (RLS denies anon + authenticated reads by default).
drop policy if exists ambassador_anon_insert on ambassador_applications;
create policy ambassador_anon_insert on ambassador_applications
  for insert
  to anon, authenticated
  with check (
    full_name is not null
    and length(full_name) between 1 and 200
    and email is not null
    and length(email) between 5 and 320
    and email like '%@%.%'
  );

-- =============================================================
-- DONE. Apply via Supabase MCP / SQL Editor / supabase db push.
-- =============================================================
