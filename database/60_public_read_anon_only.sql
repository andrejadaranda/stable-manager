-- =============================================================
-- 60_public_read_anon_only.sql
-- CRITICAL FIX — migration 59 created RLS policies that exposed
-- horses + stables + services to ALL authenticated users across
-- ALL stables. Authenticated users were supposed to rely on the
-- existing tenant-scoped policies, but `to anon, authenticated`
-- ADDED a permissive policy that bypassed them.
--
-- This caused cross-stable horse roster leak — Andreja (TJK owner)
-- saw Avalon's horses (Athena, Apollo, etc.) in /dashboard/horses.
--
-- Fix: restrict anon-read policies to anon role ONLY. Authenticated
-- users fall back to the tenant-scoped read policies (correct
-- behaviour). Public /s/[slug] still works because anon role is
-- exactly what the un-authenticated fetch uses.
--
-- Already applied via Supabase MCP. This file is the canonical
-- source-of-truth copy.
-- =============================================================

drop policy if exists stables_anon_public_read on stables;
create policy stables_anon_public_read on stables
  for select
  to anon
  using (true);

drop policy if exists horses_anon_public_read on horses;
create policy horses_anon_public_read on horses
  for select
  to anon
  using (active = true and public_bio is not null);

drop policy if exists services_anon_public_read on services;
create policy services_anon_public_read on services
  for select
  to anon
  using (active = true);
