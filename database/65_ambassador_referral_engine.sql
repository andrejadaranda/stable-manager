-- =============================================================
-- 65_ambassador_referral_engine.sql
--
-- Ambassador referral engine: ambassadors + referrals tables, tier +
-- commission logic, approval and paid-referral functions, RLS.
--
-- Tiers (by paid referrals):  bronze 0–4 (€5) · silver 5–14 (€7) ·
--   gold 15–39 (€10) · platinum 40+ (€15). Commission uses the tier
--   AT TIME OF PAYMENT. A referral counts only when paid (paid invoice).
--
-- Already applied via Supabase MCP. This file is the canonical
-- source-of-truth copy. Verified via SQL: approve → code+bronze,
-- 5 paid referrals → silver, €25 commission, idempotent on invoice.
-- =============================================================

do $$ begin
  create type ambassador_tier as enum ('bronze','silver','gold','platinum');
exception when duplicate_object then null; end $$;
do $$ begin
  create type ambassador_status as enum ('new','approved','rejected','suspended');
exception when duplicate_object then null; end $$;
do $$ begin
  create type referral_status as enum ('pending','paid','refunded');
exception when duplicate_object then null; end $$;

create table if not exists ambassadors (
  id                     uuid primary key default gen_random_uuid(),
  application_id         uuid references ambassador_applications(id) on delete set null,
  user_id                uuid,
  full_name              text not null,
  email                  text not null unique,
  country                text,
  status                 ambassador_status not null default 'approved',
  referral_code          text unique,
  stripe_promo_id        text,
  tier                   ambassador_tier not null default 'bronze',
  paid_referrals         int not null default 0,
  total_commission_cents int not null default 0,
  created_at             timestamptz not null default now(),
  approved_at            timestamptz default now(),
  admin_notes            text
);
create index if not exists ambassadors_code_idx on ambassadors (referral_code);
create index if not exists ambassadors_user_idx on ambassadors (user_id);

create table if not exists referrals (
  id                uuid primary key default gen_random_uuid(),
  ambassador_id     uuid not null references ambassadors(id) on delete cascade,
  referred_email    text,
  stripe_invoice    text unique,
  status            referral_status not null default 'pending',
  amount_cents      int,
  commission_cents  int,
  tier_at_payment   ambassador_tier,
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);
create index if not exists referrals_ambassador_idx on referrals (ambassador_id);

create or replace function ambassador_tier_for(n int) returns ambassador_tier
language sql immutable as $$
  select case
    when n >= 40 then 'platinum'::ambassador_tier
    when n >= 15 then 'gold'::ambassador_tier
    when n >= 5  then 'silver'::ambassador_tier
    else 'bronze'::ambassador_tier
  end;
$$;

create or replace function ambassador_commission_cents(t ambassador_tier) returns int
language sql immutable as $$
  select case t
    when 'platinum' then 1500
    when 'gold'     then 1000
    when 'silver'   then 700
    else 500
  end;
$$;

create or replace function gen_referral_code(p_name text) returns text
language plpgsql as $$
declare base text; code text; tries int := 0;
begin
  base := upper(regexp_replace(coalesce(split_part(p_name,' ',1),'AMB'), '[^A-Za-z0-9]', '', 'g'));
  if length(base) < 3 then base := 'LONGREIN'; end if;
  base := left(base, 10);
  loop
    code := base || '-' || upper(substr(md5(random()::text), 1, 4));
    exit when not exists (select 1 from ambassadors where referral_code = code);
    tries := tries + 1;
    if tries > 20 then code := base || '-' || upper(substr(md5(random()::text||clock_timestamp()::text),1,6)); exit; end if;
  end loop;
  return code;
end;
$$;

create or replace function approve_ambassador_application(p_app_id uuid)
returns ambassadors
language plpgsql security definer set search_path = public as $$
declare app ambassador_applications%rowtype; amb ambassadors%rowtype;
begin
  select * into app from ambassador_applications where id = p_app_id;
  if not found then raise exception 'application % not found', p_app_id; end if;
  select * into amb from ambassadors where application_id = p_app_id;
  if found then return amb; end if;
  insert into ambassadors (application_id, full_name, email, country, status, referral_code, tier)
  values (app.id, app.full_name, app.email, app.country, 'approved',
          gen_referral_code(app.full_name), 'bronze')
  on conflict (email) do update set status = 'approved'
  returning * into amb;
  update ambassador_applications set status = 'approved' where id = p_app_id;
  return amb;
end;
$$;

create or replace function record_paid_referral(
  p_code text, p_invoice text, p_email text, p_amount_cents int)
returns referrals
language plpgsql security definer set search_path = public as $$
declare amb ambassadors%rowtype; ref referrals%rowtype; comm int;
begin
  select * into amb from ambassadors where referral_code = p_code and status = 'approved';
  if not found then raise exception 'no approved ambassador for code %', p_code; end if;
  select * into ref from referrals where stripe_invoice = p_invoice;
  if found then return ref; end if;
  comm := ambassador_commission_cents(amb.tier);
  insert into referrals (ambassador_id, referred_email, stripe_invoice, status,
                         amount_cents, commission_cents, tier_at_payment, paid_at)
  values (amb.id, p_email, p_invoice, 'paid', p_amount_cents, comm, amb.tier, now())
  returning * into ref;
  update ambassadors
     set paid_referrals = paid_referrals + 1,
         total_commission_cents = total_commission_cents + comm,
         tier = ambassador_tier_for(paid_referrals + 1)
   where id = amb.id;
  return ref;
end;
$$;

alter table ambassadors enable row level security;
alter table ambassadors force  row level security;
alter table referrals   enable row level security;
alter table referrals   force  row level security;

drop policy if exists ambassadors_self_read on ambassadors;
create policy ambassadors_self_read on ambassadors
  for select to authenticated using (user_id = auth.uid());

drop policy if exists referrals_self_read on referrals;
create policy referrals_self_read on referrals
  for select to authenticated using (
    ambassador_id in (select id from ambassadors where user_id = auth.uid())
  );
-- =============================================================
