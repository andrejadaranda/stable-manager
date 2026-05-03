# Longrein — Strategic Backlog (Apr 2026) [historical]

> **Superseded (2026-05-02):** Renamed Stable OS / Hoofbeat → **Longrein**. Live sprint backlog = `Longrein-Readiness-Audit-2026-05-02.md`. The deferred-vs-built feature list below is still useful as Phase 3+ context.

> Vienintelis kelias nuo dabartinio MVP iki rinkos top'ų. Sintezė iš MASTER.md, PRODUCT_BUILD_PLAN.md, LAUNCH_PLAN.md, BRAND_NAMES.md plius faktinis kodo auditas po šiandien dienos darbo (2026-04-28). Atnaujinti po kiekvienos sprintės.

---

## 1. Trumpa esmė — kur stovim faktiškai

**Padaryta** (jau veikia, RLS-protected, deploy'inta arba lokaliai paleista):

- Calendar (R+W, edit, cancel)
- Horses module + naujas premium profilis (sticky hero, Overview/Sessions/Health tabs, KPIs, activity ring, heatmap, training breakdown)
- Sessions ("activity log", 4-laukų quick-add bottom sheet, inline note edit)
- Health & care records (status cards + timeline, +Add record popover, resolve injury, delete)
- Clients (R+W)
- Payments (owner-only)
- Expenses (owner-only)
- Team / invite flow
- Client portal (My Lessons, My Sessions, My Payments)
- Dashboard home (KPI strip + today timeline)
- Settings tree (`/dashboard/settings/{stable,profile,security,billing}`)
- **Chat module** (general stable channel + direct chats, RLS, realtime, presence deferred to Phase 5)
- DB foundation: 18 migracijų pritaikytos live ant `dluxzjphpokzkrwmmibe.supabase.co`

**Kas šiandien atrakinta** (po šios sesijos darbo): sessions table + RLS + force; horses.owner_client_id + horses.photo_url; horse_health_records + RLS; sessions force RLS; chat module (3 lentelės + 4 funkcijos + realtime publication).

**Kas vis dar trūksta** (audit per 2026-04-28):

| Sluoksnis | Statusas | Blocker priežastis |
|---|---|---|
| Stripe billing | DB migracija (16) parašyta, **dar nepritaikyta**; `lib/stripe/server.ts` parašytas, bet `npm install stripe` dar nepaleistas | `package.json` nėra `stripe` dependency |
| Email infra (Resend) | Visiškai nepradėta | — |
| i18n (LT/EN) | Hardcoded strings, joks `next-intl` | — |
| Public landing page | `/` = redirect į `/login` | Nėra route'o |
| GDPR (privacy / terms / cookie banner / data export) | Nėra route'ų | Privaloma EU klientams |
| Sentry | Nėra | Silent prod errors = trust killer |
| Custom domain | `.vercel.app` URL | DNS setup reikalas |
| Onboarding wizard | Empty state'ai egzistuoja, bet nėra "first-run" guidance | Activation killer |
| Recurring lessons | Nėra | RRULE-based, prašoma stables |
| SMS reminders | Nėra | Twilio passthrough, add-on €9 |
| Weekly digest email | Nėra | Activation engine |
| Brand identity | Joks logo, pavadinimas, brand color tokens | "Stable OS" placeholder |
| Type generation | `Database = any` | `supabase gen types` nesuritės |
| Sessions force RLS | ✅ pritaikyta šiandien | — |

---

## 2. Top 10 darbų, kurie atneš pirmus pinigus

Kiekvienas turi: **outcome** (kas pasikeičia), **effort** (žmondienos), **kas blokuoja**, **kodėl dabar**.

### 1. Pasirink ir užregistruok pavadinimą + domeną

**Outcome:** turi tikrą brand'ą, ne "Stable OS" placeholder'į. Customer'iai gali pasakyti vardą.

**Effort:** 2 val (research) + 1 val (registracija)

**Kodėl dabar:** kiekviena diena be vardo = kiekviena marketing materija turi būti perdaryta vėliau. Maksimaliai brangu vėluoti.

**Rekomendacija:** iš BRAND_NAMES.md shortlist'o — **Cadence** arba **Hayloft**. Cadence stipresnis equestrian fit (kadansas dressūroje), bet TM crowded; Hayloft silpnesnis pozicijoje, bet 100% ownable. Mano balsas: **Hayloft** — silpnesnis pozicijoje bet niekada neturėsi TM problemų ir `.com` greičiausiai laisvas. Jeigu Cadence — privalu paimti TM advisor'ių (€500–1500).

### 2. Stripe end-to-end

**Outcome:** trial → checkout → webhook → subscriptions row → plan-gated limits.

**Effort:** 1.5 d

**Kas blokuoja:** `npm install stripe`, env vars (`STRIPE_SECRET_KEY`, 3× `STRIPE_PRICE_*`), Stripe products sukonfigūruoti dashboard'e, 16_subscriptions migracija pritaikyta gyvai (šiandien pritaikoma).

**Kodėl dabar:** iki čia tu negali paimti pinigų. Tai vienintelis 0→1 šuolis monetizacijoje.

### 3. Onboarding wizard naujai stable'ai

**Outcome:** owner po signup'o per 60 sekundžių turi: 1 horse, 1 client, 1 lesson, 1 stable name. Aktyvacija kyla 2-3×.

**Effort:** 1 d

**Kas blokuoja:** nieko (existing services pakanka).

**Kodėl dabar:** master.md mato "owner pirmą kartą atidarius app patenka į tuščią calendar, be konteksto" kaip #6 launch killer'į. Yra empty states, bet nėra "guided first run".

### 4. LT lokalizacija (next-intl)

**Outcome:** UI lietuviškai. Beachhead market = LT/PL/Baltics.

**Effort:** 1 d (i18n setup) + 1 d (string ekstraktas + LT vertimas)

**Kas blokuoja:** vertimo time (vartotojas pats sakys ar pirks paslaugą).

**Kodėl dabar:** be LT kalbos pirmas 50 customers neateis. Anglų kalba = friction LT yard'ams.

### 5. GDPR pakuotė: privacy + terms + cookie banner + data export

**Outcome:** legaliai galim siūlyti EU klientui. Trust badge.

**Effort:** 4 val

**Kodėl dabar:** be šito nė vienas serious B2B prospect'as net neperskaito siūlymo. Privalu prieš Stripe.

### 6. Recurring lessons (RRULE)

**Outcome:** stables kuriame fiksuotus weekly time slots (e.g. "Eva mokosi kiekvieną antradienį 17:00"). 80% real-world lessons yra recurring.

**Effort:** 1 d

**Kodėl dabar:** kiekvienas design partner'is to paklaus per pirmą savaitę. Be šito jie sako "bet aš kasdien įrašinėju tas pačias 30 lessons".

### 7. Weekly digest email (owner)

**Outcome:** kiekvieną pirmadienį owner gauna: revenue, hours ridden, top-5 horses, outstanding balances. Stay-top-of-mind ir proof-of-value.

**Effort:** 2 d (email infra + template + send job)

**Kas blokuoja:** Resend account + Cron (Vercel Cron arba Supabase Edge Function).

**Kodėl dabar:** churn killer. Owner kuris kas savaitę gauna proof-of-value mažiau churn'ina.

### 8. Sentry + Vercel/Plausible analytics

**Outcome:** žinai apie silent errors. Žinai pageview'us ir conversion funnel'į.

**Effort:** 1 val Sentry + 30 min Plausible

**Kodėl dabar:** be šito tu visiškai aklas. Pirmas customer'is patirtu 500 errors ir ne atsiųs kalbėtis, jis tiesiog išeitų.

### 9. Custom domain (`app.<vardas>.lt` ar `.com`)

**Outcome:** vercel URL pakeičia tikras vardas. Trust + SEO.

**Effort:** 30 min DNS + Vercel verify

**Kas blokuoja:** turi būti pasirinktas vardas (item #1).

### 10. SMS reminders (Twilio add-on €9)

**Outcome:** owner gali siųsti automatinius reminderius dieną prieš lesson'ą. Add-on revenue.

**Effort:** 1 d

**Kodėl dabar:** stables klausia šito kaip pirmo "extra fees" justification'o. Easy add-on revenue per customer.

---

## 3. Antrojo sluoksnio backlog (po pirmų 10)

Šitie ne tokie urgent, bet būtini iki 100 customers.

| # | Item | Effort | Faza |
|---|---|---|---|
| 11 | Soft delete UI (active=false) horses + clients | 1 val | Polish |
| 12 | Change-password puslapis | 1 val | Polish |
| 13 | Notifications system (in-app bell) | 2 d | Engagement |
| 14 | Audit log UI (kas ką keitė ir kada) | 2 d | Compliance |
| 15 | Reports — financial summary (P&L month/year) | 1 d | Owner value |
| 16 | Mobile PWA install metadata | 4 val | Mobile UX |
| 17 | Hero photo upload + crop | 4 val | Polish |
| 18 | Goals & progress tab (per spec'ą §6.D) | 2 d | Premium feel |
| 19 | Horse media uploads (Storage + RLS) | 2 d | Premium feel |
| 20 | Polish lokalizacija (PL launch) | 1 sav | Geographic expansion |
| 21 | DE lokalizacija (DACH launch) | 1 sav | Geographic expansion |
| 22 | Help center (Notion publish + Loom videos) | continuous | Self-serve onboarding |
| 23 | Referral program (15% recurring, kicks @ #50 customer) | 2 d | Growth loop |
| 24 | Public marketing page (`<vardas>.com`) | 2 d | Acquisition |
| 25 | SEO content engine (10 articles in LT/EN) | continuous | Acquisition |

---

## 4. Sąmoningai NEDARYTINI dalykai

Per master.md sąrašą + šio audit'o pridėtinius. Nedaryti, kol bent 3 paying customers neprašys.

- ❌ Native mobile apps (PWA pakanka)
- ❌ Multi-location per stable
- ❌ Pedigree / breeding records
- ❌ Competition entry tracking
- ❌ Multi-stable per user
- ❌ Inventory / feed tracking
- ❌ Embedded video lessons
- ❌ Community forum
- ❌ Two-factor auth (kol < 50 customers)
- ❌ AI-driven analytics (data quality dar neturi)
- ❌ White-label (kol nėra Premium-tier customer'io)
- ❌ Public API (kol nėra integration partner'io)
- ❌ Marketplace (vet/farrier directory)
- ❌ Native horse-passport / FEI integration

---

## 5. Žinomi technical debt items

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | `lib/types/database.ts` = `any` | Low | `supabase gen types typescript --linked > lib/types/database.ts` |
| 2 | `lib/stripe/server.ts` references `stripe` package — not in package.json | Medium | `npm install stripe` |
| 3 | `13_sessions_policies.sql` neturi `force row level security` | ~~Medium~~ FIXED 2026-04-28 (18_sessions_force_rls.sql) | — |
| 4 | `services/horseProfile.ts` joins `horses_owner_client_id_fkey` — Supabase auto-named, gali skirtis | Low | Patikrinti `pg_constraint` po apply 15 |
| 5 | Chat realtime nesidalina sender info per WebSocket — naudoja router.refresh fallback | Low | Pridėti `chat_messages_with_sender` view su SECURITY DEFINER |
| 6 | Horse media uploads — Storage bucket nesukurtas | Medium | Sukurti `horse-photos` bucket Supabase Studio |
| 7 | No site URL config Supabase (Auth → URL Configuration) | Low | Reikės kai įjungsim email confirmation/magic links |
| 8 | No backup beyond Supabase Pro daily | Medium | Backblaze B2 weekly @ customer #20 |
| 9 | No rate limiting | Medium | Vercel Edge middleware |
| 10 | Stable-OS-Business-Plan.docx commit'inta į Git | Low | Pašalinti jei kada nors public'insi |

---

## 6. Šios dienos darbo žurnalas (2026-04-28)

**Padaryta:**

- Chat module Phase 1+2 (DB + service layer + UI + realtime). 6 nauji failai, 3 migracijos.
- Horse Profile premium redesign Phase 1+2. 8 nauji files (services/horseProfile, services/horseHealth, OverviewTab, SessionsTab, HealthTab, AddSessionSheet, SessionNoteEditor, AddHealthRecordForm, HealthRecordActions, ScheduleRail, ComingSoonTab, HorseProfileHero, HorseProfileTabs).
- HORSE_PROFILE_DESIGN.md spec parašytas.
- 6 migracijos pritaikytos live DB: 09 chat, 10 chat policies, 11 chat functions, 12 sessions, 13 sessions policies, 14 horse photos (column), 15 horse owner, 17 horse health, 18 sessions force RLS.
- Visi tsc check'ai švarūs (išskyrus pre-existing `lib/stripe/server.ts` no-package klaidą).

**Atrasta:**

- `package.json` neturi `stripe` package — Stripe billing dar negalimas.
- `13_sessions_policies.sql` praleido `force` RLS — pataisyta 18_sessions_force_rls.sql.
- Migracijos 12-15 buvo repo'e bet niekad nepritaikytos live — visos pritaikytos šiandien.

**Likę šios dienos sesijos veiksmai:** šis backlog dokumentas + onboarding wizard (jei laiko liks) + NEXT_STEPS.md su konkrečiais user veiksmais.

---

## 7. Decision triggers (kada keisti planą)

Iš MASTER.md, papildžiau:

| Trigger | Action |
|---|---|
| Month 8: own stable still not using daily | Stop building, fix the product |
| Month 12: < 35 paying customers | Honest re-evaluation; consider non-tech co-founder |
| Month 24: < €2k MRR | Stop new acquisition, support existing, write post-mortem |
| 3+ customers ask same feature | Build it (overrides "deferred" list) |
| 1 cross-tenant data leak | Public incident report, full security audit, halt feature work |
| Founder works > 50h/week on this | Pause. Burnout = #1 failure mode |
| **Stripe failure rate > 5%** | Pause new signups, debug payments first |
| **Trial-to-paid < 12% over 50 cohorts** | Re-think pricing or onboarding; don't add features |
| **NPS < 30 (n ≥ 20)** | Customer interview round; freeze backlog |

---

## 8. North-star metric

Iš LAUNCH_PLAN.md: **Weekly Active Stables** (WAS) = stables kurie per pastarąsias 7 dienas sukūrė ≥5 lessons + ≥1 payment.

Target trajectory:
- Sav 4: 1 (own stable)
- Sav 8: 4 (own + 3 design partners)
- Sav 13: 12 (90-day target)
- Mėn 12: 35 (year-1 go/no-go gate)

Visa kita (signups, MRR, downloads) yra leading/lagging metrics. WAS yra real product-market signal.

---

*Šis dokumentas live. Atnaujinti po kiekvieno pasikeitimo. Top-1 punktas dabar: pasirinkti vardą + paleisti Stripe (#1, #2). Be jų — niekas kita matter'is.*
