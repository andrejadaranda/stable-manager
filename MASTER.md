# Longrein — Master Document

> **Note (2026-05-02):** Working titles in this doc were "Stable OS" and later "Hoofbeat." Final product name as of 2026-05-02 is **Longrein** (`hoofbeat.eu` was unavailable). Inline references to "Stable OS," "Hoofbeat," and the placeholder domain `stableos.lt` are historical — the live brand is **Longrein** with domain `longrein.eu`. The active sprint plan lives in `Longrein-Readiness-Audit-2026-05-02.md`.

**Versija:** 1.1  ·  **Atnaujinta:** 2026-05-02  ·  **Statusas:** Live MVP, prep for 10 Founding Members launch (target 2026-05-23)

> Vienintelis dokumentas, kurį verta atsidaryti grįžus prie projekto po pertraukos. Apima esmę, kas padaryta, kas liko, verslo planą, technical reference ir operational runbook.

---

## 1. Esmė vienu sakiniu

**Stable OS** — multi-tenant SaaS, pakeičiantis whatsapp + excel + popierinį diary, kuriais Europos arklidės šiandien valdo lessons, klientus, mokėjimus ir arklių darbo krūvį.

Diferenciatorius — **horse workload tracking** (jokia kita stable management apps to nedaro), su EU-pirma lokalizacija (LT/PL/DE), GDPR, SEPA.

---

## 2. Verslo modelis (santrauka iš full plan'o)

### 2.1 Target

| Segmentas | Profile | Willingness to pay |
|---|---|---|
| Hobby (1–4 horses) | Privatūs | €0 — neperka |
| **Small (5–15 horses)** | Side-business yard | €10–25/mo |
| **Mid (15–40 horses) ⭐ ICP** | Full-time owner + 1–3 trainers | €30–70/mo |
| Large (40+) | Owner + admin staff | €80–200/mo |

**Sweet spot: mid-size lesson + livery yards** — 15–40 horses, 50–150 active clients, 1–3 trainers.

### 2.2 Pricing (3 tiers)

| Tier | Mo | Annual eff. | Limits |
|---|---|---|---|
| Starter | €19 | €16 | 10 horses, 30 clients, 1 trainer |
| **Pro (anchor)** | **€49** | **€42** | 40 horses, 200 clients, 5 trainers, workload, portal, SEPA |
| Premium | €99 | €84 | Unlimited + multi-location, branding |

Add-ons: SMS reminders +€9, white-label portal +€19.
Trial: 14 dienų, no-CC, full Pro features. Tikslas: 18–25% conversion.

### 2.3 Markets (sequenced)

1. **Beachhead: Baltics + Poland** (~1,200–1,800 stables) — months 0–18
2. Add **Germany / Austria / Switzerland** (~50k stables) — month 18+
3. Defer everything else.

### 2.4 Realistic numbers

| Customers | MRR | ARR |
|---|---|---|
| 50 | €1,950 | €23,400 |
| 100 | €3,900 | €46,800 |
| 200 | €7,800 | €93,600 |
| 500 | €19,500 | €234,000 |

**24-mo realistic outcome:** €4–9k MRR · 50–180 stables.
**60-mo ceiling without funding/sales hire:** €25–40k MRR.

### 2.5 Reali sėkmės tikimybė

| Outcome | Probability |
|---|---|
| Total failure (<€500 MRR) | 30% |
| Marginal (€500–2k MRR) | 30% |
| **Lifestyle business (€2–10k MRR)** | **25%** |
| Strong vertical SaaS (€10–40k) | 12% |
| Outsized (€40k+ / acquisition) | 3% |

Aggregated meaningful success: **~40%** (vs ~10–15% solo SaaS baseline). Tris dalykai padidina tai: (a) founder turi domain credibility, (b) niche under-served, (c) costs negligible.

### 2.6 Three commitments (from plan)

1. **24 mėn. discipline** su explicit go/no-go review month 12 (target: 35 paid customers, €1,300 MRR).
2. **Stay bootstrapped.** Don't raise. Funding distorts a niche this size.
3. **Use own stable as the lab.** If product nenaudojamas daily own yard'e per 8 savaites — STOP.

---

## 3. Kur dabar (production status)

### 3.1 Live deployment

```
URL:      https://stable-manager-teal.vercel.app
GitHub:   github.com/andrejadaranda/stable-manager (private)
Vercel:   vercel.com/andrejadarandas-projects/stable-manager
Supabase: dluxzjphpokzkrwmmibe.supabase.co (region: West EU / Ireland)
```

**Auto-deploy:** kiekvienas `git push` į `main` branch → Vercel rebuild ~60 s.

### 3.2 Test accounts

| Role | Email | Password |
|---|---|---|
| Owner | test@test.com | test12345 |
| Employee | employee@test.com | test12345 |
| Client | client@test.com | test12345 |

Šie egzistuoja **vienoje stable** ("Test Stable", slug `test-stable`). Daromas atskiras prod testas — kurk antrą stable per `/signup` su kitu email.

### 3.3 Phase status (vs. business plan roadmap)

| Phase | Plan | Realybė |
|---|---|---|
| **Phase 1 — Foundation (mo 0–3)** | Internal alpha, own yard | ✅ Padaryta technically. Reikia naudoti realiame yard'e. |
| **Phase 2 — Design partners (mo 3–6)** | 5 Baltic stables | ⬜ Dar nepradėta. |
| Phase 3 — Public beta + revenue (mo 6–12) | 35 paying, €1,300 MRR | ⬜ |
| Phase 4 — Compounding (mo 12–24) | 150 paying, €5,850 MRR + DE launch | ⬜ |
| Phase 5 — Decision point (mo 24) | go/no-go | ⬜ |

---

## 4. Padaryta — visa techninė bazė

### 4.1 Database schema (8 migrations)

```
database/01_extensions.sql            pgcrypto, btree_gist
database/02_schema.sql                7 tables + same-stable triggers
database/03_helpers.sql               current_stable_id(), current_user_role(), ...
database/04_policies.sql              RLS enabled + forced on all tenant tables
database/05_functions.sql             client_balance, horse_workload, view, RPCs
database/06_auth.sql                  provision_stable, attach_user_to_stable
database/07_calendar_policies.sql     client portal can read horse/trainer names
database/08_clients_skill_level.sql   skill_level enum + column
```

**Tables:** `stables`, `profiles`, `horses`, `clients`, `lessons`, `payments`, `expenses`.
**Constraints worth knowing:** exclusion constraint blokuoja horse + trainer double-booking; same-stable triggers blokuoja cross-tenant references.

### 4.2 Service layer (`/services`)

```
clients.ts    list, listUnlinkedClients, listWithUpcomingCount, getClient,
              createClient, updateClient, getOwnClient
horses.ts     list, listWithWeeklyWorkload, getHorse, createHorse, updateHorse,
              getHorseWorkloadStatus
lessons.ts    createLesson (+ horse availability preflight + 23P01 mapping),
              updateLessonStatus, updateLesson, getCalendar, getHorseWorkload,
              getHorseLessons, getClientLessons
payments.ts   addPayment, listPayments, getClientBalance, getClientAccountSummary
expenses.ts   addExpense, listExpenses
profiles.ts   listTrainers, listMembers (su admin email lookup)
```

Visi service'ai daro `requireRole(...)` arba `requireOwnerOrClientSelf(...)` prieš query. RLS antras gynybos sluoksnis.

### 4.3 Modules (full UI built)

| Module | Owner | Employee | Client | Files |
|---|---|---|---|---|
| **Calendar** | R+W, edit/cancel | R+W, edit/cancel | own only (read) | `app/dashboard/calendar/`, `components/calendar/` |
| **Horses** | R+W, edit | R+W, edit | — | `app/dashboard/horses/`, `components/horses/` |
| **Clients** | R+W, edit | R+W, edit | own only (read) | `app/dashboard/clients/`, `components/clients/` |
| **Payments** | R+W | — | own only (read) | `app/dashboard/payments/`, `components/payments/` |
| **Expenses** | R+W | — | — | `app/dashboard/expenses/`, `components/expenses/` |
| **Team** | R+W (invite) | — | — | `app/dashboard/team/`, `components/team/` |
| **Client portal** | — | — | My Lessons + My Payments | `app/dashboard/my-lessons/`, `app/dashboard/my-payments/` |

### 4.4 Auth + 3 ringed protection

1. **Page-level role gate** — `requirePageRole("owner", ...)` redirect'ina anksčiau nei page query.
2. **Service-level role check** — `requireRole(...)` prieš Supabase call.
3. **Postgres RLS** — `FORCE ROW LEVEL SECURITY` ant kiekvienos tenant lentelės.

**Audited & fixed bugs (iš originalaus audit'o):**
- Role escalation hole (clients updating own role) — fixed: `profiles_owner_all` only.
- Cross-stable absorb via `attach_user_to_stable` upsert — fixed: hard reject.
- N+1 cross-table refs on lessons / payments / expenses — fixed: same-stable triggers.

### 4.5 UX features

- **Edit + cancel lessons** — click any card → dialog su status / time / price / notes; quick "Cancel lesson" button; horse-availability preflight; `23P01` exclusion errors mapped į friendly messages.
- **Edit horses + clients** — Edit button detail page header'yje, dialog reuse.
- **Invite flow** — `/dashboard/team`: invite employee + invite portal client (su existing `clients` row link); admin createUser + RPC + auto-rollback on failure.
- **Mobile responsive sidebar** — hamburger drawer < 768px, slide-in animation, route-change auto-close.
- **Design vibe** — soft floating cards, colored dots, generous spacing, atmospheric grey background, avatar circle in sidebar, soft elevation `box-shadow` instead of borders.

### 4.6 Test infrastructure

```
database/tests/00_seed.sql            5 auth users + 2 stables + lessons/horses/clients
database/tests/test_plan.sql          14 tests covering RLS isolation, double-booking,
                                       cross-stable refs, balance/workload functions,
                                       attach safety, role escalation
database/tests/99_cleanup.sql         reset
```

Run `test_plan.sql` after any DB change to verify isolation still works.

---

## 5. Architektūra (1-paragraph)

Next.js 14 App Router, Server Components default, Server Actions for writes, `@supabase/ssr` for cookie-based auth. All data flows: Component → Service → Supabase under user JWT → RLS-filtered query. Service-role client used only by Team invite flow + Team page email lookup. No client-component talks to Supabase directly — service layer is the single seam.

```
app/dashboard/<module>/page.tsx     → renders
  └ services/<module>.ts            → enforces role + queries Supabase
       └ Supabase Postgres + RLS    → returns only caller's stable rows
```

---

## 6. Liko padaryti — prioritized roadmap

### 6.1 Pre-launch must-haves (this week / next)

| # | Item | Why | Effort |
|---|---|---|---|
| 1 | **Use the app daily on your own stable** | Plan'o Phase 1 critical commitment — be šito likę punktai bevertis. | Daily use |
| 2 | Custom domain (`app.stableos.lt` ar pan.) | `stable-manager-teal.vercel.app` neužkrečia trust'o klientams | 30 min |
| 3 | Sentry integration | Be jo nesužinosi apie silent prod errors | 30 min |
| 4 | Soft delete (active=false) UI for horses + clients | Šiuo metu tik edit, ne archive | 1 val |
| 5 | Change-password page | Invited users gauna owner-set password, reikia leisti pakeisti | 1 val |
| 6 | Empty-state CTAs | Naujas owner lendina į tuščią Calendar — reikia "Add first horse → client → lesson" wizard | 2 val |
| 7 | GDPR basics: privacy policy + ToS + cookie banner + data export endpoint | Reikia prieš realius klientus | 4 val |

### 6.2 Pre-revenue (months 0–3, ~10 customers)

| # | Item | Effort |
|---|---|---|
| 8 | Stripe Checkout + webhook → `stables.plan` | 4 val |
| 9 | Plan-gated limits (Starter: 10 horses, Pro: 40, etc.) | 2 val |
| 10 | Onboarding email (Resend free tier) | 1 val |
| 11 | Lithuanian + English translations (`next-intl`) | 4 val + content time |
| 12 | Recurring lessons (RRULE-based) | 1 d |
| 13 | SMS reminders add-on (Twilio passthrough) | 1 d |
| 14 | Reports — weekly summary email to owners (revenue, hours, top horses) | 2 d |
| 15 | Soft cap UI when approaching limits | 2 val |

### 6.3 Pre-scale (months 3–12)

| # | Item | Effort |
|---|---|---|
| 16 | Polish translation + PL launch | 1 sav |
| 17 | German translation + DE launch | 1 sav |
| 18 | SEPA invoicing + VAT MOSS reporting | 3 d |
| 19 | PWA install metadata + offline shell | 1 d |
| 20 | Public marketing page (separate route or domain) | 2 d |
| 21 | Help docs / Loom video library | continuous |
| 22 | Referral program (15% recurring commission, kicks in @ customer #50) | 2 d |
| 23 | Vercel Analytics / Plausible | 30 min |

### 6.4 Sąmoningai ATIDĖTI (don't build yet)

Sako business plan'as: nedaryk, kol bent 3 paying customers neprašys.

- ❌ Native mobile apps (PWA install veikia)
- ❌ Multi-location per stable (schema palaiko, bet UI sudėtingas)
- ❌ Pedigree / breeding records (not in ICP)
- ❌ Competition entry tracking (Equisoft niche)
- ❌ Multi-stable per user (memberships table — vėliau)
- ❌ Inventory / feed tracking
- ❌ Embedded video lessons / coaching tools
- ❌ Community forum / chat between clients
- ❌ Two-factor auth (kol < 50 customers)
- ❌ Audit log UI (DB updates yra; UI laukia compliance prašymo)

---

## 7. Žinomos problemos / weak spots

| # | Problem | Severity | Plan |
|---|---|---|---|
| 1 | Owner-set passwords for invited users — no change-password page | Medium | Build change-password page (item #5 viršuje) |
| 2 | Site URL nesukonfigūruotas Supabase (Auth → URL Configuration) | Low | Reikia tik kai įjungsim email confirmation arba magic links |
| 3 | TS stub `lib/types/database.ts` — `Database = any` | Low | Run `supabase gen types typescript --linked > lib/types/database.ts` |
| 4 | Vercel build skips Node version pin | Low | Add `engines.node` į `package.json` jei skirtumai pasimatys |
| 5 | No backup plan beyond Supabase Pro daily backups | Medium | Set up Backblaze B2 weekly off-platform backup at customer #20 |
| 6 | No rate limiting on signup/login | Medium | Vercel Edge middleware OR Supabase auth rate limits — patikrinti default'us |
| 7 | Stable-OS-Business-Plan.docx yra Git'e | Low (private repo) | Pašalinti jei kada nors public'insi |

---

## 8. Operational runbook

### 8.1 Deploy a fix

```bash
cd "/Users/andrejadaranda/Documents/Claude/Projects/APP"
# edit files
git add . && git commit -m "what changed"
git push                    # → Vercel auto-deploys in ~60s
```

### 8.2 Run a DB migration

1. Write SQL file in `database/0X_<name>.sql`
2. Open Supabase dashboard → SQL Editor → New query
3. Paste + Run
4. Commit the .sql file to git (so future redeploys / new envs apply it)

### 8.3 Add a test user manually

```sql
-- 1. Create auth user via Supabase Dashboard → Authentication → Add user
-- 2. Get the auth_user_id, then:
insert into profiles (auth_user_id, stable_id, full_name, role)
values (
  'PASTE-AUTH-UID',
  (select id from stables where slug = 'YOUR-STABLE-SLUG'),
  'Their Name',
  'employee'  -- or 'client'
);

-- 3. For client: also link their clients row
update clients
   set profile_id = (select id from profiles where auth_user_id = 'PASTE-AUTH-UID')
 where id = 'PASTE-CLIENTS-UUID';
```

### 8.4 Local dev

```bash
cd "/Users/andrejadaranda/Documents/Claude/Projects/APP"
npm run dev            # http://localhost:3000
```

If anything weird:
```bash
rm -rf .next && npm run dev    # clears stale build cache
```

### 8.5 Restore from git

```bash
git log --oneline                       # find commit hash
git checkout <hash> -- path/to/file     # restore single file
# OR
git revert <hash>                       # undo a commit, keep history
```

### 8.6 Verify isolation after a change

Open Supabase SQL Editor, paste relevant block from `database/tests/test_plan.sql`. Especially Tests 6 (cross-stable), 7+8 (double-booking), 9+10 (cross-stable refs), 14 (role escalation).

---

## 9. Tech reference (cheat sheet)

### 9.1 Env vars

```
NEXT_PUBLIC_SUPABASE_URL       https://dluxzjphpokzkrwmmibe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY      sb_secret_...        ← server-only, never client
```

Both Vercel + `.env.local`. `.env.local` is gitignored.

### 9.2 Folder map

```
app/
  (auth)/login,signup/      auth shell
  dashboard/                 protected routes
    calendar/horses/clients/payments/expenses/team/   modules
    my-lessons/my-payments/  client portal
    layout.tsx                auth gate + sidebar
  layout.tsx                  root html
  globals.css                 Tailwind + .card utility
components/
  auth/                       login + signup forms
  calendar/                   week-view, create/edit lesson
  horses/clients/payments/expenses/  lists + create/edit
  team/                       member list + invite forms
  dashboard/                  sidebar, page-shell
database/                     SQL migrations + tests
lib/
  auth/   session.ts (getSession), redirects.ts (requirePageRole), actions.ts
  supabase/   client.ts, server.ts (server + admin)
  utils/  dates.ts (week math)
services/                     business logic, role-gated, RLS-aware
middleware.ts                 cookie refresh + /dashboard auth gate
```

### 9.3 Key SQL functions to remember

| Function | What it returns | Used by |
|---|---|---|
| `current_stable_id()` | uuid (caller's stable) | Every RLS policy |
| `current_user_role()` | enum (owner/employee/client) | Every RLS policy |
| `current_client_id()` | uuid or null (own clients.id) | Client portal RLS |
| `provision_stable(name, slug, full_name)` | new stable id | Owner signup |
| `attach_user_to_stable(auth_user_id, full_name, role)` | new profile id | Invite flow |
| `client_balance(client_id)` | numeric (negative = owes) | Detail balance + portal |
| `horse_workload(id, from, to)` | (lessons, minutes) | Horse detail page |
| `check_horse_available(...)` | boolean | Lesson create preflight |

### 9.4 Lesson exclusion constraints (the magic preventing double-booking)

```sql
constraint no_horse_double_booking exclude using gist (
  horse_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('scheduled', 'completed'))

constraint no_trainer_double_booking exclude using gist (
  trainer_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status in ('scheduled', 'completed'))
```

Cancelled / no_show lessons free up the slot automatically.

---

## 10. Marketing wedge (from plan, kad neužmirštum)

> **"Stop running your stable on WhatsApp and Excel.
> Schedule lessons, track payments, and protect your horses — in one place."**

- **Buyer trigger:** scheduling + payments (eliminates daily WhatsApp chaos)
- **Differentiator:** horse workload tracking ("don't overwork your horses")
- **Credibility:** founder owns a stable, builds in public on Instagram
- **Anti-positioning:** ne "another scheduling app", ne "horizontal CRM"

---

## 11. Decision triggers (kada keisti planą)

| Trigger | Action |
|---|---|
| Month 8: own stable still not using daily | Stop building, fix the product |
| Month 12: < 35 paying customers | Honest re-evaluation; consider non-tech co-founder |
| Month 24: < €2k MRR | Stop new acquisition, support existing, write post-mortem |
| 3+ customers ask same feature | Build it (overrides "deferred" list) |
| 1 cross-tenant data leak | Public incident report, full security audit, halt feature work |
| Founder works > 50h/week on this | Pause. Burnout = #1 failure mode. |

---

## 12. Closing reminder

> *"The biggest mistake in this category is not building the wrong product — it is over-investing in a 6-month build before talking to 5 customers. Do those 5 conversations first. Everything else follows."* — iš tavo verslo plano

Technical foundation **padaryta**. Toliau distribution game. Code velocity dabar yra mažiausia tavo problema.

---
*Šitas dokumentas live'inas. Atnaujinti kiekvieną kartą kai pasikeičia status quo arba planas.*
