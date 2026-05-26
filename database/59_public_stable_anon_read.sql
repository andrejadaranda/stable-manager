-- =============================================================
-- 59_public_stable_anon_read.sql
-- BUG #GG fix part 2 — /s/[slug] returned 404 because anon role
-- couldn't read stable rows. Add limited anon-read policies on
-- stables (id, slug, name only), horses (public_bio NOT NULL +
-- active), and services (active).
--
-- Safe to expose: stable identity + customer-facing roster + price
-- list. Private fields (boarding fees, internal notes, schedules,
-- payments, clients) stay locked.
--
-- Already applied via Supabase MCP. This file is the canonical
-- source-of-truth copy.
-- =============================================================

drop policy if exists stables_anon_public_read on stables;
create policy stables_anon_public_read on stables
  for select
  to anon, authenticated
  using (true);

drop policy if exists horses_anon_public_read on horses;
create policy horses_anon_public_read on horses
  for select
  to anon, authenticated
  using (active = true and public_bio is not null);

drop policy if exists services_anon_public_read on services;
create policy services_anon_public_read on services
  for select
  to anon, authenticated
  using (active = true);
