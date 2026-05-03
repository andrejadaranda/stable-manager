# Longrein — Product Build Plan [historical]

> **Superseded (2026-05-02):** Renamed Stable OS / Hoofbeat → **Longrein**. Live build plan = `Longrein-Readiness-Audit-2026-05-02.md`.

**Versija:** 1.0 · **Sukurta:** 2026-04-26 · **Statusas:** Phase 1 in progress

> Praktinis build plan'as, papildantis [master.md](./master.md) (kontekstas + status quo) ir [LAUNCH_PLAN.md](./LAUNCH_PLAN.md) (90-dienų launch strategija). Šitas dokumentas — implementacijos pjūvis: kas trūksta kode, kas pirma, kokia tvarka, kada baigta.

---

## 1. Kas trūksta dabar (faktinis kodo audit)

Audit'as ant tikrų failų, ne ant master.md teiginių.

### 1.1 Infrastruktūros sluoksniai, kurių nėra

| Sluoksnis | Trūksta | Įrodymas |
|---|---|---|
| **Monetizacija** | Joks Stripe code, joks `app/api/`, jokios `plan/trial_ends_at` kolonos service'uose | `package.json` + `app/api/` neegzistuoja |
| **Email / komunikacija** | Joks Resend / SendGrid / Postmark | Nėra dependency |
| **Settings** | Jokio `/dashboard/settings/*` | Glob rezultatas patvirtina |
| **GDPR** | Jokio `/privacy`, `/terms`, cookie banner, data export | Trūksta route'ų |
| **i18n** | Hardcoded EN/LT mix, jokio `next-intl` | Nėra dependency |
| **Public surface** | `/` = redirect to /login, jokio landing | `app/page.tsx` |
| **Dashboard home** | `/dashboard` = redirect to calendar, jokio overview | `app/dashboard/page.tsx` |
| **Onboarding** | Joks wizard, joki sample data | Nėra route'ų |
| **Notifications** | Joks toast/sonner, joks notif lentelės | Komponentai patys per `useState` valdo "Saved" |
| **Analytics** | Joks Plausible / Vercel Analytics | Nėra |
| **Error monitoring** | Joks Sentry | Nėra |
| **Brand identity** | Jokio logo, jokios primary spalvos token'o, jokio favicon set | `tailwind.config.ts` tuščias |

### 1.2 Kas yra ir veikia gerai

CRUD viskam (calendar, horses, clients, payments, expenses, team, client portal). RLS triple-protection. Exclusion constraints (horse + trainer double-booking). Same-stable triggers. Auth + invite flow. Mobile sidebar. Service layer švarus (`requireRole`, `requireOwnerOrClientSelf`). Test plan SQL.

### 1.3 Jei sutrumpinti: turim solidų back-office tool, bet ne SaaS produktą

~30% to, ko reikia paying SaaS launch'ui. 70% likę trūksta visi launch infrastructure layeriai.

---

## 2. Kas blokuoja paying users

Po prioritizacijos — blockerių sąrašas. Be šių dalykų, neturim kaip net paimti pinigų:

1. **Joks Stripe / billing kodas** — vartotojas neturi UI, kuris iš jo paimtų pinigus.
2. **Joks settings page** — owner negali pakeisti net stable vardo, save profile, password.
3. **Jokio dashboard home** — owner pirmą kartą atidarius app patenka į tuščią calendar, be konteksto kas yra produktas.
4. **Empty states tuščios** — naujas vartotojas nesupranta kas pirma, niekur nėra "Add your first horse" CTA prasmingai.
5. **Jokia GDPR kontūra** — privacy, ToS, cookie banner, data export. EU klientams legaliai negalim duoti SaaS.
6. **Jokios profesionalios išvaizdos** — dabartinis dizainas funkcionalus bet "tax software" lygio. Žmogus nemokės už tai, kas atrodo kaip Excel su skin'u.
7. **Jokio email infra** — nei welcome, nei trial-ending, nei payment-failed. Negalim valdyti billing lifecycle.
8. **Custom domain ir Sentry** — `.vercel.app` URL ir silent prod errors. Trust killer.

---

## 3. Implementacijos planas (fazės)

Kiekviena fazė turi aiškų tikslą + DoD. Phase 1 = šios sesijos darbas.

### Phase 1 — Profesionali pamatas + dashboard + design system (THIS SESSION)

**Tikslas:** Owner atidarius app pirmą kartą gauna profesionalų UX, kuris atrodo kaip "kažkas, už ką galima mokėti".

**Building:**

1. **Design system foundation**
   - `tailwind.config.ts`: brand color tokens (terracotta primary), spacing/radius/shadow extend
   - `app/globals.css`: CSS variables layer, refined surfaces, focus rings
   - `components/ui/`: Card, Button, Badge, Input, Select, Field, PageHeader, StatCard, Section, EmptyState, Toast

2. **Dashboard home** (`/dashboard` rewrite — replace redirect)
   - StatCard grid: Today's lessons, This week, Active horses, Active clients, Outstanding balance, Monthly revenue, Monthly expenses
   - Today timeline (lessons sorted by time)
   - Quick actions

3. **Settings section** (`/dashboard/settings/*`)
   - Index with cards
   - `/settings/stable` — edit stable name (owner only)
   - `/settings/profile` — edit own full name
   - `/settings/security` — change password placeholder + signed-in info
   - `/settings/billing` — placeholder ("Coming soon")

4. **Better empty states**
   - Calendar (CTA → "Add your first horse")
   - Horses (CTA → "+ New horse")
   - Clients (CTA → "+ New client")
   - Payments (CTA → "Add a payment")
   - Expenses (CTA → "Add an expense")

5. **Friendly errors + success layer**
   - `lib/errors/friendly.ts` — map known codes (23505, 23P01, 42501, FORBIDDEN, etc.) to LT messages
   - Toast component for client-side feedback
   - Action results consistent shape

6. **Sidebar + chrome refresh**
   - Brand accent on active nav
   - Refined avatar + role chip
   - Sign out as ghost button at bottom

7. **List pages styling polish** (no logic changes)
   - Horses, Clients, Payments, Expenses
   - StatusBadge primitive replaces ad-hoc dots

8. **Calendar visual refresh**
   - Lesson card status colors (scheduled/completed/cancelled)
   - Cleaner time display, subtle hover

**Phase 1 — Definition of Done:**
- [ ] `npm run build` passes (TS + lint clean)
- [ ] `/dashboard` shows 7 stat cards + today timeline (not redirect)
- [ ] `/dashboard/settings` accessible from sidebar profile area or url
- [ ] All empty states have CTA + explanation
- [ ] Brand color visible on sidebar active item, primary buttons, badge accents
- [ ] At least 1 friendly error works end-to-end (e.g. duplicate slug on signup)
- [ ] No raw Postgres error code shown anywhere

### Phase 2 — Monetization (next session)

**Tikslas:** Vartotojas gali įvesti kortelę ir mokėti. Trial flow veikia.

Items: Stripe Checkout + webhook, plan-gated limits, 14d trial, dunning, billing settings, EU VAT, transactional emails (Resend), trial countdown banner.

**DoD:** End-to-end test customer signs up → uses trial → upgrades → we receive €49.

### Phase 3 — Legal + public surface

GDPR pakuotė, custom domain, public landing page, Sentry, analytics.

**DoD:** Galim kviesti realų EU klientą, niekas teisinis netruksta.

### Phase 4 — Activation engine

Onboarding wizard, weekly digest email, recurring lessons, SMS add-on, referrals.

**DoD:** Trial → paid conversion ≥18% over a 30-day cohort.

### Phase 5 — Public launch

Content engine, SEO, IH/HN launch, case studies, help docs.

**DoD:** €1k MRR, 25 paying customers, 1 channel duoda 50%+ signups.

---

## 4. Implementacijos tvarka (kodas, eilė)

Kodas nesiūbavimui pageidautina ši eilė:

1. `tailwind.config.ts` (tokens) — niekas dar netaikoma, bet visi consumers pasiruošę
2. `app/globals.css` (refined layer) — backwards compatible su `.card`
3. `components/ui/*.tsx` (primitives) — naudojama tik tos vietos, kurios atnaujinamos
4. `lib/errors/friendly.ts` + Toast provider mounted į `app/dashboard/layout.tsx`
5. `app/dashboard/page.tsx` rewrite (dashboard home) + reuse services
6. `app/dashboard/settings/*` (new tree)
7. Empty states atnaujinimas existing list components — minimaliai keičiam
8. List pages styling polish — purely visual
9. Calendar week-view styling polish
10. Sidebar refresh
11. `npm run build` + manual smoke

Kiekvienas žingsnis — savarankiškas commit. Jei kažkas suluošė — revert vienas žingsnis, ne visas plan'as.

---

## 5. Rizikos ir kaip jas valdom

| # | Rizika | Mitigation |
|---|---|---|
| 1 | Dizaino sistema sulaužo egzistuojančius components | Nauji primitives gyvena `components/ui/`, **naudojam tik ten kur atnaujinam**. Senas kodas naudoja `.card` ir tai veikia toliau |
| 2 | Brand color konfliktuoja su esamais `text-emerald-500` ir kt. | Paliekam status colors (emerald, rose, neutral), brand color naudojam tik primary actions / accent |
| 3 | Naujos service funkcijos sulaužia RLS | Visi nauji service callers kvietai per `requireRole(...)` ir `getSession()`. Servisai grąžina friendly error, kad UI nereikėtų raw Supabase error rodyti |
| 4 | TS errors po Supabase types refresh | `Database = any` paliekam šitam Phase'ui — type safety nesvarbu, kol nepaleidom prod |
| 5 | Phase 1 padidina UI, bet niekas neperkeltas — partial dizaino blynas | Konkretus surface list (dashboard + settings + empty states + chrome). Listų pilnas redesign — Phase 2/3 |
| 6 | Server action redirects nesuderinti su client toast | Server action grąžina `{ ok, error }` arba redirect; client component skaito search params (`?msg=...`) ir parodo toast. Standartas vienas |

---

## 6. Effort estimacijos (Phase 1)

| Komponentas | Effort |
|---|---|
| Design system tokens + globals.css | 30 min |
| `components/ui/*` primitives | 1 val |
| Friendly errors + Toast | 30 min |
| Dashboard home (KPIs + today timeline) | 1.5 val |
| Settings section (index + 4 sub-pages) | 1 val |
| Empty states atnaujinimas (5 modules) | 30 min |
| Sidebar + layout refresh | 30 min |
| List pages styling polish | 45 min |
| Calendar styling polish | 30 min |
| Build verification + smoke notes | 15 min |
| **Total Phase 1** | **~7 val** |

---

## 7. Definition of Done — visom fazėm

### Phase 1 — DoD (galim šiandien užbaigti)
- `npm run build` clean
- `/dashboard` rodo realią KPI overview
- Settings veikia, owner gali updatinti stable + savo profile
- Visų 5 modulių empty states su CTA
- Niekur nerodom raw error codes
- Brand color konsistentus
- Mobile patikrinta (375px viewport veikia)

### Phase 2 — DoD
- Stripe test mode end-to-end veikia (signup → trial → checkout → webhook → plan upgraded)
- Plan limits enforce'ina (Starter 10 horses, Pro 40, etc.)
- Owner mato billing history `/settings/billing`
- 4 transactional emails siunčiasi (welcome, trial-ending, payment-success, payment-failed)

### Phase 3 — DoD
- `app.stableos.lt` veikia su SSL
- `/privacy`, `/terms`, cookie banner, `/api/data-export` funkcionuoja
- Sentry capture'ina test error
- Plausible mato pageview

### Phase 4 — DoD
- 30-day cohort konversija ≥18%
- Owner gauna pirmadieniais weekly digest email
- Recurring lessons UI veikia (RRULE)

### Phase 5 — DoD
- 25 paying customers
- €1k+ MRR
- 1 channel matuojamai duoda 50%+ signups

---

## 8. Kaip testuoti Phase 1 lokalei (po implementacijos)

```bash
cd "/Users/andrejadaranda/Documents/Claude/Projects/APP"
npm run dev
# Atidaryti http://localhost:3000
# Login: test@test.com / test12345
```

**Smoke test scenarijus:**

1. Login owner role → atsidaro `/dashboard` (ne /calendar redirect)
2. Matosi 7 KPI cards + today timeline + quick actions
3. Profile area sidebar'e → klick → `/dashboard/settings`
4. `/dashboard/settings/stable` — pakeisti stable name → save → matosi flash success
5. `/dashboard/settings/profile` — pakeisti full name → save → matosi flash success
6. `/dashboard/horses` — jei tuščia, matosi empty state su CTA "Add your first horse"
7. Pridėti horse → matosi naujame stiliuje
8. Pridėti dvigubo booking lesson → matosi friendly error, ne raw 23P01
9. Mobile (375px) — viskas veikia, sidebar drawer, dashboard cards stack'inasi
10. Logout → /login

**Failure modes that must NOT happen:**
- Raw Postgres errors UI'e
- Cross-tenant data leakage (test plan.sql turi praeit po DB pakeitimų — bet šis Phase neliečia DB)
- Mobile UI lūžimas <375px

---

## 9. Closing

Šitas Phase'as **nelieka** prie business model, monetization, legal, marketing. Tai sąmoninga: jei produktas neatrodo profesionaliai, joks Stripe checkout neišsigelbės. Pirma — make it look like something worth paying for. Tada — paimk pinigus.

> *"You can't outsell bad design in B2B SaaS. The customer's first instinct after a 5-second scan determines whether they read your pricing page."* — pragmatic SaaS rule

---
*Šis dokumentas live. Atnaujinti po kiekvienos fazės su faktiniu DoD checked off.*
