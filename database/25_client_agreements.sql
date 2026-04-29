-- =============================================================
-- 25_client_agreements.sql
--
-- Per-client signed-document tracker. The owner curates a checklist
-- (waiver, GDPR consent, stable rules, boarding contract, other) and
-- records when each one is signed. v1 = tracking-only — no upload, no
-- e-signature. Just "yes/no/when" with a notes field.
--
-- Boarding flag: when `required_for_boarders = TRUE`, the agreement
-- counts toward a client's "boarder readiness" score (used by the
-- client detail panel to surface what's missing).
--
-- RLS:
--   * read   : owner + employee always see; client sees their own
--   * write  : OWNER only
-- =============================================================

create type agreement_kind as enum (
  'waiver',
  'gdpr_consent',
  'stable_rules',
  'boarding_contract',
  'other'
);

create table client_agreements (
  id                     uuid primary key default gen_random_uuid(),
  stable_id              uuid not null references stables(id) on delete cascade,
  client_id              uuid not null references clients(id) on delete cascade,
  kind                   agreement_kind not null,
  -- Free-form name for kind='other' (e.g. "Vaccine handling consent").
  custom_label           text,
  signed_at              date not null default current_date,
  required_for_boarders  boolean not null default false,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- One row per (client, kind, custom_label) so duplicates are
  -- impossible. The custom_label coalesce makes this safe for the
  -- 'other' kind too.
  unique (client_id, kind, custom_label)
);
create index on client_agreements(stable_id, client_id);

create trigger trg_client_agreements_updated
  before update on client_agreements
  for each row execute function set_updated_at();

-- ---------------- SAME-STABLE ENFORCEMENT ----------------
create or replace function client_agreements_enforce_same_stable() returns trigger
language plpgsql as $$
declare s uuid;
begin
  select stable_id into s from clients where id = new.client_id;
  if s is null or s <> new.stable_id then
    raise exception 'client_agreements.client_id must belong to the same stable';
  end if;
  return new;
end $$;

create trigger client_agreements_same_stable
  before insert or update on client_agreements
  for each row execute function client_agreements_enforce_same_stable();

-- ---------------- RLS ----------------
alter table client_agreements enable row level security;
alter table client_agreements force  row level security;

create policy client_agreements_read_staff on client_agreements
  for select
  using (stable_id = current_stable_id()
         and current_user_role() in ('owner', 'employee'));

create policy client_agreements_read_self on client_agreements
  for select
  using (stable_id = current_stable_id()
         and client_id = current_client_id());

create policy client_agreements_write_owner on client_agreements
  for all
  using (stable_id = current_stable_id()
         and current_user_role() = 'owner')
  with check (stable_id = current_stable_id());

-- =============================================================
-- DONE. Run this in the Supabase SQL Editor (or supabase db push).
-- =============================================================
