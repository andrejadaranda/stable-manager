# Personal Horse Owner plan — €10/mo

**Status:** strategic plan + data scaffold. Not built yet — ships
Q3 2026 after first 30 Founding 15 stable signups validate the
B2B motion.

---

## TL;DR — why this matters

Right now Longrein is a B2B SaaS for stables. Every signup creates
a `stable` row + RLS narrows everything to one stable's data. The
typical buyer is the stable owner paying €25/mo (Founding 15) or
€49/mo (Standard).

But a huge under-served slice exists below the stable: **individual
horse owners who board their horse somewhere else** and want their
own private record of training sessions, health, expenses, photos
— without paying €49/mo SaaS for a feature set they don't use.

A €10/mo "Personal Horse Owner" tier captures that segment without
cannibalising the stable plan (different feature set, different
buyer, different positioning).

---

## Market sizing — rough back-of-envelope

EU horse owners ~7M. Lithuania alone ~30,000 active riders.
Of those, conservative 20% own (or partly own) a horse → 6,000 in
Lithuania → ~1.4M EU. Conversion at 0.5% to a €10/mo SaaS = 7,000
paying users → €840k ARR. Not bottom-line transformative on its
own, but meaningful and product-strategic.

---

## Feature scope (€10/mo Personal Owner)

**Has:**
- 1–3 horses (hard cap — keeps the value proposition simple)
- Horse profile (basics: name, breed, DOB, photos, notes)
- Training session log (your own rides + boarder-trainer notes)
- Health records (vet visits, farrier visits, vaccinations, weight)
- Expense log (your own — feed share, supplements, vet bills,
  competition fees) with category breakdown
- Photo album (cloud-backed, no quota for now)
- PDF export of all of the above (annual review)
- Reminders for vet/farrier visits, vaccination due dates

**Doesn't have** (deliberate — keeps stable plan defensible):
- Lessons / scheduling — no point for a sole owner
- Multi-user roles (no employees, no clients)
- Payments / invoicing
- Boarding charges
- Stable-level reporting
- Custom branding

**Upgrade path:** if a Personal Owner ever rents arena time and
starts teaching clinic lessons, one-click migration to Standard
plan (€49/mo) keeps all their data and adds the multi-user/lessons
layer.

---

## Pricing + packaging

| Tier              | Price        | Horses | Users     | Lessons | SMS reminders |
| ----------------- | ------------ | ------ | --------- | ------- | ------------- |
| **Personal Owner** | €10/mo      | up to 3 | 1         | —       | —             |
| Founding 15        | €25/mo lifetime | unlimited | unlimited | ✅ | ✅            |
| **Standard**       | €49/mo      | unlimited | unlimited | ✅       | ✅             |

14-day free trial for Personal Owner; card required (same as
Standard) so it doesn't attract the freeloader segment that wrecks
conversion math.

---

## Technical architecture

The cleanest abstraction is a NEW `account_type` enum on `stables`:

```sql
create type account_type as enum ('stable', 'personal');
alter table stables add column account_type account_type not null default 'stable';
```

Personal accounts get a `stables` row exactly like everyone else
(reuses every RLS policy, every service, every multi-tenant
guarantee) — they just have `account_type = 'personal'`,
`name = "<Owner's name>'s horses"`, and a feature-flag-style
middleware gate that hides multi-user pages.

This is the right call vs a parallel `personal_accounts` table
because:
- RLS is the hardest part of any multi-tenant system; reusing it
  is free correctness.
- 95% of features (horse, session, health, expense, photo) are
  already stable-scoped and need zero changes.
- Migrations between plans are a one-line UPDATE.

**Schema scaffold (deploy when Q3 2026):**

```sql
alter table stables
  add column if not exists account_type account_type not null default 'stable',
  add column if not exists max_horses int;

-- Personal accounts capped at 3 horses; stable accounts uncapped (NULL).
alter table stables
  add constraint stables_horse_count_within_limit check (
    account_type = 'stable' or max_horses is not null
  );

-- Trigger fires on horses INSERT to enforce the cap.
create or replace function enforce_horse_limit()
returns trigger language plpgsql as $$
declare
  v_account_type account_type;
  v_max_horses   int;
  v_current_count int;
begin
  select account_type, max_horses into v_account_type, v_max_horses
    from stables where id = new.stable_id;
  if v_max_horses is null then
    return new;  -- stable account, no cap
  end if;
  select count(*) into v_current_count
    from horses where stable_id = new.stable_id and active = true;
  if v_current_count >= v_max_horses then
    raise exception 'Horse limit reached (% / %)', v_current_count, v_max_horses;
  end if;
  return new;
end $$;
```

**Stripe pricing:**
- New product: "Longrein Personal Owner — €10/mo"
- Add `STRIPE_PRICE_PERSONAL` env var → `lib/stripe/server.ts` PRICE_IDS
- Update checkout route: branch on intended `account_type` and route
  the right price_id

**Signup flow:**
1. New landing: `longrein.eu/personal` — separate hero, "Just for
   horse owners" positioning, €10/mo CTA
2. Signup form asks "Personal" or "Stable"
3. `provision_stable` RPC takes `p_account_type` param + sets it
   on the new stables row + sets `max_horses = 3` when personal
4. Subscription middleware checks `account_type` to gate stable-only
   pages (Team, Clients, Payments by stable, etc.)

**UI changes:**
- Sidebar variants by account_type:
  - Stable: full nav (Dashboard, Calendar, Horses, Clients, Sessions, Payments, Expenses, Team, Settings)
  - Personal: trimmed nav (My Horses, Sessions, Health, Expenses, Photos, Settings)
- Dashboard becomes "Your horses at a glance" for personal accounts
- Settings → Billing differs (single plan, no team)

---

## Go-to-market

**Validate before building:** before writing a line of code, run a
1-week paid Meta ads test with a landing page that captures emails
for "Longrein for individual horse owners — €10/mo when it launches".
Budget €200, target Lithuania first. If we get >150 signups in a
week, the demand is real. Below that, kill the project and focus on
Standard plan growth.

**Launch channel:** instagram-first — the Personal Owner buyer is
on IG looking at horses all day. LinkedIn isn't.

**Pricing experiment:** consider €7/mo first-month pricing (Spotify
model) to lower trial friction.

---

## Why deferred from Founding 15 launch

Building this BEFORE 30 stables are paying = wrong order:
1. Stable plan needs to prove it can convert + retain at €49/mo
   (or €25 Founding) — that's the more valuable customer
2. Adds a whole new positioning/messaging axis that confuses the
   current "professional stable management" story
3. Splits product attention across two buyer personas right when
   we should be focused

**Trigger to build:** when we have 30 paying stable customers AND
3+ of them mention "my owners are asking about this for themselves".

---

## What ships now

Nothing — this is a strategic plan + technical scaffold for
when we trigger Q3 2026. No code, no DB migration. Re-read this
doc when the trigger condition fires.
