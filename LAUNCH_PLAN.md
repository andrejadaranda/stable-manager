# Longrein — 90-Day Launch & Monetization Plan (historical)

> **Superseded (2026-05-02):** Doc was written under the working title "Stable OS." Final product name is **Longrein**; the live launch plan is now `Longrein-Readiness-Audit-2026-05-02.md` (3-week Founding Members sprint, free 12-month trial, no Stripe in W1–W3). References below to `stableos.lt` should read `longrein.eu`. Pricing tiers + ICP + welfare wedge all carry over.

**Versija:** 1.0 · **Sukurta:** 2026-04-26 · **Tikslas:** nuo "live MVP" iki "first €1k MRR + 25 paying stables"

> Šis dokumentas tęsia [master.md](./master.md) sekcijas 6.1–6.3. Master.md = "kas yra". Šitas = "kas vyksta artimiausias 13 savaičių, dieną po dienos".

---

## 0. TL;DR — kur einam

**Situacija:**
- Live MVP veikia ant Vercel + Supabase. Calendar, horses, clients, payments, expenses, team, client portal — viskas padaryta.
- 0 paying customers. 0 design partners. 0 pinigų.
- Arklidė savininkas pats produkto dar nenaudoja kasdien. Tai #1 rizika.

**90-dienų tikslas (iki 2026-07-26):**

| Metrika | Baseline | Target |
|---|---|---|
| **Paying customers** | 0 | **10–15** |
| **MRR** | €0 | **€400–700** |
| **Design partners (free Pro)** | 0 | **5** |
| Trial signups (no-CC) | 0 | 80–120 |
| Trial → paid conversion | — | ≥18% |
| Own stable daily usage | partial | 100% (8 weeks straight) |

**Mantra:** *"Pirma 5 pokalbiai. Tada code. Tada launch."* Niekur neapsisuksim be realių klientų.

---

## 1. Šiaurės žvaigždė (vienas metric)

**Weekly Active Stables (WAS)** = arklidžių, kurios per pastarąsias 7 dienas sukūrė bent 5 lessons + 1 payment.

Kodėl ne MRR, ne signups, ne DAU:
- MRR meluoja early (free trials inflate'ina)
- Signups meluoja (žmonės užsiregistruoja ir dingsta)
- WAS = produkto realus naudojimas tame use case, dėl kurio mokės

Target trajectory:
- Week 4: 1 (own stable)
- Week 8: 4 (own + 3 design partners)
- Week 13: 12

---

## 2. 90-dienų planas (sprint po sprintos)

13 savaičių, 6 sprintai po ~2 savaites. Kiekvienas sprintas turi vieną aiškų **outcome**, ne tik task list.

### Sprint 0 — Pamatas (savaitės 1–2) · Outcome: *Profesionali bazė, ant kurios negėda kviesti klientus*

| # | Task | Effort | Sėkmės kriterijus |
|---|---|---|---|
| S0.1 | **Pradėti naudoti pats kasdien savo arklidėje** | Daily | Iki 8 wk gale: 100% lessons + payments per app, ne WhatsApp. Šitas užbaigia 2 daiktus iš plano. |
| S0.2 | Custom domain `app.stableos.lt` (arba `.com`) + SSL | 30 min | URL kartojasi visur, nebėra `vercel.app` |
| S0.3 | Sentry frontend + backend integration | 30 min | Test error pasirodo dashboarde |
| S0.4 | Empty-state wizard ("Pridėk pirmą arklį → klientą → pamoką") | 4 val | Naujas owner per <3 min sukuria pirmą lesson |
| S0.5 | Change-password page | 1 val | Invited employee gali pasikeisti slaptažodį |
| S0.6 | Soft delete (active=false) UI horses + clients | 2 val | Owner gali "archive" horse, nedingsta historic data |
| S0.7 | GDPR pakuotė: Privacy Policy + ToS + Cookie banner + `/data-export` endpoint | 4 val | Iuridinis MVP, neperfect bet pakanka EU SaaS |
| S0.8 | TypeScript types iš Supabase (`supabase gen types`) | 15 min | Nebėra `Database = any`, type errors realūs |
| S0.9 | Plausible Analytics arba Vercel Analytics + 5 key events | 1 val | Žinom ką daro vartotojai per pirmą session |

**Definition of done:** `app.stableos.lt` veikia, error monitoring on, naujas vartotojas pereina onboarding be klausimų, GDPR esmė patenkinta.

### Sprint 1 — Monetizacijos stack (savaitės 3–4) · Outcome: *Vartotojas gali įvesti kortelę ir pradėti mokėti*

| # | Task | Effort | Sėkmės kriterijus |
|---|---|---|---|
| S1.1 | Stripe Checkout (Starter / Pro / Premium) + webhook → `stables.plan` | 6 val | Test kortele galima upgrade'inti |
| S1.2 | 14-dienų no-CC trial logika (`stables.trial_ends_at`) | 2 val | Naujas signup gauna 14d Pro |
| S1.3 | Plan-gated limits (10/40/unlimited horses, etc.) — soft cap UI | 4 val | Bandant pridėti 11-tą horse Starteryje — modal "Upgrade to Pro" |
| S1.4 | Billing settings page (`/dashboard/settings/billing`) — change plan, cancel, invoice history | 3 val | Owner mato ką moka, gali keisti |
| S1.5 | Trial countdown banner + 3 email reminders (D-7, D-3, D-1) | 3 val | Niekas nepražiūri trial pabaigos |
| S1.6 | Stripe customer portal link (cancel/update card) | 30 min | Owner gali pats spręsti billing klausimus |
| S1.7 | EU VAT handling (Stripe Tax automatic) + invoice PDF su VAT | 2 val | Lietuvos klientas gauna teisingą sąskaitą |
| S1.8 | Resend (free tier) + 4 transactional emails (welcome, trial-ending, payment-success, payment-failed) | 3 val | Visi billing eventai turi email |
| S1.9 | Dunning flow — 3 retry'ai per 7d, tada downgrade į free read-only | 2 val | Failed payment nesugriauna santykio |

**Definition of done:** Galiu siųsti tikrą klientą į `/signup`, jis užsiregistruoja, naudoja 14d, įveda kortelę, ir mes gauname €49.

### Sprint 2 — "Max nice" UX poliravimas (savaitės 5–6) · Outcome: *Žmogus iš WhatsApp + Excel išeina po 1 demo*

Šitas sprintas — kur "max nice" gimsta. Visi smulkūs poliravimo darbai sudėti į vieną fokuso savaitę, kad nesimirvalkiotų prie kitų užduočių.

| # | Task | Effort | "Nice" detalė |
|---|---|---|---|
| S2.1 | **Brand identity v1** — logo, palette, tipografija, illustration system | 1 d | Ne stocky. Mažas wordmark + arklio piktograma. Žemiškos spalvos (sage, terracotta, oat). |
| S2.2 | Onboarding wizard su 3 žingsniais + sample data toggle | 4 val | "Skip and start with sample stable" — žmogus mato live calendar po 30s |
| S2.3 | Empty states su personality (calendar, horses, clients, payments) | 3 val | Iliustracija + 1 CTA + 1 link į pavyzdį. Ne "No data" |
| S2.4 | Loading skeletons visur kur >300ms | 2 val | Niekur nerodom blank page |
| S2.5 | Toast notifications system review (success/error/info standartas) | 2 val | Visi service'ai grąžina friendly errors per `useToast()` |
| S2.6 | Mobile UX audit (60% naudos iš telefono) — calendar, lesson dialog, sidebar | 1 d | Veikia su nykščiu. Visi inputs >44px. |
| S2.7 | Dashboard home page — KPI cards (this week's lessons, revenue, balances owed, top horses by hours) | 4 val | Owner atidaręs app pirmą kartą per dieną mato "kas svarbu šiandien" |
| S2.8 | Calendar polish — drag to reschedule, ctrl-click multi-select, today indicator | 1 d | Pajunta apple-quality interaction |
| S2.9 | Print/PDF horse workload weekly report | 3 val | Owner gali atspausdinti trainer'iui ant sienos |
| S2.10 | Speed pass — Lighthouse score >90 visiems puslapiams (image opt, font preload, route prefetch) | 4 val | Pirmas eilė load <1.5s ant 4G |
| S2.11 | Dark mode (sistema-aware) | 4 val | Žmonės kuriem patinka — turi |
| S2.12 | Keyboard shortcuts (`?` shows list, `n` new lesson, `c` calendar, `/` search) | 3 val | Power users myli |

**"Max nice" testas:** parodyk randomui be konteksto — turi pasakyti "wow, kuo skiriasi?". Jei ne — toliau poliruok.

### Sprint 3 — Design partners launch (savaitės 7–8) · Outcome: *5 stables aktyviai naudoja, mes mokomės kasdien*

| # | Task | Effort | Sėkmės kriterijus |
|---|---|---|---|
| S3.1 | **Landing page** (`stableos.lt`) — hero, problem/solution, screenshots, pricing, FAQ, signup | 2 d | <1.5s load, mobile-first, 1 CTA "Start free trial" |
| S3.2 | Demo video (90s Loom) — embed į landing | 4 val | Žmogus pamato whatsapp/excel chaos → app order |
| S3.3 | LT translation final pass (UI + emails + landing) | 1 d | Native LT speaker pereina pilną flow be 1 anglicizmo |
| S3.4 | Outreach list — 30 Baltic stables (Instagram + Google Maps + JotForm) | 4 val | Spreadsheet su contact, owner name, signal |
| S3.5 | Cold outreach kampanija — DM/email, 30 prospects | 1 sav | Booked 8 demos, signed 5 design partners |
| S3.6 | Design partner onboarding playbook (1:1 setup call, free Pro 6mo, monthly check-in) | 2 val | Visi 5 turi to paties tikslo: "stop using whatsapp by week 8" |
| S3.7 | In-app feedback widget (small floating button → modal) | 2 val | Jokio Intercom kol < 50 customers, bet kanalas turi būti |
| S3.8 | "Built in public" Instagram + LinkedIn launch — pirmi 3 postai (story, screenshot, why) | 3 val | First piece of distribution muscle |

**Definition of done:** 5 design partners signed, onboarded, 1 turi sukūręs ≥10 lessons. Founder daro savaitinį `office hours` Loom su jais.

### Sprint 4 — Conversion engine (savaitės 9–10) · Outcome: *Trial → paid konversija ≥18%*

| # | Task | Effort | Sėkmės kriterijus |
|---|---|---|---|
| S4.1 | Recurring lessons (RRULE-based) | 1 d | Owner sukuria "Pirmadienis 17:00, kas savaitę, Joe + Bella" |
| S4.2 | SMS reminders add-on (+€9/mo) — Twilio passthrough, 24h prieš lesson | 1 d | First add-on revenue |
| S4.3 | Weekly digest email owner'iui (revenue, hours, top horses, no-shows) | 1 d | Žmogus laukia pirmadienio email |
| S4.4 | Activation milestones (first lesson, first payment, first horse hit 80% workload) — celebrate in-app | 4 val | Trial gerai vibrina |
| S4.5 | Upgrade prompts kontekstualiai — "You've added 9/10 horses. Pro = 40 + workload." | 3 val | Sales konversija prasideda be pardavėjo |
| S4.6 | Stripe Customer Portal embed | 1 val | Switch plan be support'o |
| S4.7 | Referral primitiv — `?ref=stable-slug` tracking, 15% recurring, kicks @ 25 customers | 4 val | Word-of-mouth turi loop |
| S4.8 | Public testimonial collection — 3 design partners į landing su nuotrauka | 3 val | Social proof live |

**Definition of done:** Pažiūrim į cohort: iš trial signups Sprint 1–4 gale, ≥18% upgrade'ina į paid.

### Sprint 5 — Public launch (savaitės 11–13) · Outcome: *€1k MRR, 25 paying customers, replicable channel'as*

| # | Task | Effort | Sėkmės kriterijus |
|---|---|---|---|
| S5.1 | Public launch postas — Indie Hackers + Hacker News + LinkedIn + LT FB grupės | 3 d | 200+ landing visits per dieną pirmas savaitę |
| S5.2 | Content engine — 5 blog posts (SEO foundation): "Whatsapp arklidei", "Kaip apsaugoti arklį nuo overwork", "Pirmieji 30 dienų digital arklidėje", "GDPR Lietuvos arklidėms", "Excel vs purpose-built" | 1 sav | 5 indexed straipsniai → long-tail organic |
| S5.3 | Instagram content engine — 3 posts/sav (founder face + product clip + customer story) | continuous | 1k followers @ wk 13 |
| S5.4 | LT YouTube short demo seria (3 video po 60s — schedule, payment, horse workload) | 2 d | Embed visur kur galima |
| S5.5 | Help center (Notion public arba Help Scout) — 15 articles | 3 d | Support tickets nukrita 50% |
| S5.6 | Google Search Console + sitemap + structured data | 2 val | Indexing dirba |
| S5.7 | First "case study" — design partner #1 metric pasakoja "before/after" | 4 val | Sales asset |
| S5.8 | **Go/no-go review** vs original 12-month plan target (35 paying, €1,300 MRR) | 2 val | Aiški decision: continue/adjust/stop |

**Definition of done:** 25 paying. €1k+ MRR. Vienas channel'as duoda 50%+ signups (tikriausiai LT FB grupės arba Instagram). Žinom kuris ir kodėl.

---

## 3. "Max nice" — produkto poliravimo principai

Tai ne sąrašas, tai filtras kiekvienai page review.

### 3.1 Vizualinis layeris

1. **Niekur nėra "ne baigtas" jausmas.** Empty states, loading states, error states — visur turi UI, ne blank.
2. **Vienas akcento spalvos atspalvis per kontekstą.** Calendar = teal, payments = green, expenses = amber. Vartotojas mokosi color-code automatiškai.
3. **Whitespace virš tankumo.** Geriau 3 cards 1 ekrane su oru, nei 8 stuffed.
4. **Tipografijos hierarchija viduj 3 sizes.** Heading, body, caption. Viskas kitas — variant'ai (weight/color).
5. **Soft shadows > borders.** Master.md mini "soft elevation `box-shadow` instead of borders" — laikomės to globaliai.
6. **Animation tikslinga, ne dekoratyvi.** Calendar slide kai keiti savaitę. Card lift kai hover. Be daugiau.

### 3.2 Sąveikos layeris

1. **Mažiau klikų užbaigti dažniausią užduotį.** Lesson kūrimas — 3 klik max. Ne 7.
2. **Optimistic UI.** Klikinai "mark complete" — UI atsako iškart, server fail revertina su toast.
3. **Undo > confirm.** Cancel lesson rodoma toast'e su "Undo" 5s. Vietoj "Are you sure?" modal'o.
4. **Keyboard parity.** Visi buttons + dialogs su keyboard nav.
5. **Searchable everywhere.** Cmd+K — global search horses/clients/lessons.

### 3.3 Turinio layeris

1. **Calling buttons rezultato vardu.** "Save lesson", ne "Submit". "Schedule lesson", ne "Create".
2. **Errors paaiškina kontekste.** "Bella jau turi pamoką tuo pačiu metu su Tomu. Pasirinkti kitą laiką?" — ne "Error 23P01".
3. **Skaičiai turi vienetus.** "12 lessons / 540 min / 9h" ne tik "540".
4. **LT lokalizacija pilnai native.** Ne literal vertimas. "Schedule" ≠ "Suplanuoti", o "Įrašyti pamoką" arba "Pridėti į kalendorių".
5. **Tuščia būsena moko.** Empty calendar nerodo "No data" — rodo "Pradėk nuo pirmo arklio. Tau reikia ~2 min."

### 3.4 Performans layeris

1. Lighthouse Performance ≥90 pagrindiniams puslapiams.
2. First Contentful Paint <1s desktopui, <1.5s 4G mobiliam.
3. Niekur ne daugiau 1 N+1 query'o. Visi list endpoints batch'ina.
4. Image optimization automatic (Next.js Image). Niekas ant prod >100kb hero.

---

## 4. Funkcijų priority queue

Iš master.md sekcijos 6 + nauji idėjos. Reorderintas pagal *willingness-to-pay impact*, ne effort.

### Privalomos prieš pirmus paying customers
1. ✅ Calendar / horses / clients / payments / expenses (padaryta)
2. ⏳ Stripe billing + plan limits (Sprint 1)
3. ⏳ Onboarding wizard (Sprint 0)
4. ⏳ Custom domain (Sprint 0)
5. ⏳ GDPR pakuotė (Sprint 0)
6. ⏳ Brand + landing page (Sprint 2–3)

### Pridėtinės vertės "anchor"-stiprintojai (Sprint 4)
7. ⏳ Recurring lessons — pakelia daily usage 4x
8. ⏳ Weekly digest email — primena vertę kas savaitę
9. ⏳ SMS reminders add-on — pirmas paid expansion path
10. ⏳ Horse workload alerts (in-app + email kai >85% capacity) — diferencatorius

### Konversijos varikliai
11. ⏳ Trial countdown banner + dunning emails
12. ⏳ Upgrade prompts kontekstualiai
13. ⏳ Referral tracking
14. ⏳ Activation celebrations

### Nice-to-have, kai turim 25+ customers
15. PL translation + launch
16. SEPA invoicing (kai prašys)
17. Audit log UI
18. Public API (kai prašys)
19. Webhook integrations
20. Multi-stable per user (memberships)

### Sąmoningai NE statyti (master.md sekcija 6.4 patvirtinta)
- Native mobile apps
- Pedigree / breeding
- Inventory / feed
- Community forum
- Multi-location per stable

---

## 5. Marketingo & launch strategija

Founder pranašumas — **owns a stable, builds in public**. Tai du nelygu jokiam SaaS founder'ui kompleksiniame B2B horizontaliame world'e. Reikia visada šito pranašumo eiti pirma.

### 5.1 Positioning (vienas sakinys, gimęs iš plano)

> *"The only stable management app built by a stable owner who got tired of WhatsApp at 22:00."*

LT versija:
> *"Vienintelė arklidžių valdymo programa, kurią daro arklidės šeimininkas — pavargęs nuo whatsapp 22:00."*

### 5.2 Marketing wedge & angles

| Angle | Naratyvas | Kanalas |
|---|---|---|
| **WhatsApp chaos** | "Tavo darbo diena baigiasi 18:00. WhatsApp žinutės — ne." | Instagram reels, TikTok |
| **Horse welfare** | "Tu netikrini arklio savaitės darbo krūvio. Mes tikrinam už tave." | Blog, FB grupės |
| **Built by an owner** | Founder face on landing + Instagram. Nuolat in public. | LinkedIn, IG, podcast |
| **EU-first** | GDPR, SEPA, LT. Ne JAV start-up'as primestas. | LT/PL FB groups, EU horse forums |
| **Anti-chaos** | "Nustok rašyti excel formules po pamokų." | LinkedIn for owners, IG carousel |

### 5.3 Distribution kanaliai (priority order)

| # | Kanalas | Sprint start | Effort/wk | Kodėl |
|---|---|---|---|---|
| 1 | **Founder Instagram** (LT/EN) | S0 | 3 posts | Lowest cost trust builder |
| 2 | LT FB grupės (Žirgų pasaulis, Lietuvos jojimo klubai) | S3 | 1 post + 5 comments | High intent, niche, free |
| 3 | Cold outreach DM (curated list) | S3 | 5 stables/sav | Highest signal-to-noise |
| 4 | LinkedIn (founder personal) | S0 | 2 posts | Decision-maker reach DE+PL |
| 5 | SEO content engine | S5 | 1 post/sav | Long-tail compounding |
| 6 | YouTube shorts (LT) | S5 | 1 video/sav | Demos that convert |
| 7 | Indie Hackers + HN | S5 | 1x launch | One-shot mass attention |
| 8 | Affiliate / referral (15%) | S4 | passive | Compound channel kai yra users |

### 5.4 Sales playbook (cold outreach)

**Channel:** Instagram DM. Ne email — owners atidaro IG kasdien, email retai.

**Template (LT):**
```
Sveiki, [vardas].
Pamačiau jūsų arklidę [vardas] — patiko [konkretus daiktas iš profilio].
Aš dirbu prie programos, kuri pakeičia whatsapp + excel arklidžių valdymui.
Lokalizuota lietuviškai, pritaikyta EU.
Ar galim 15 min pakalbėti šią savaitę? Rodysiu live versiją.
— [vardas], pats turiu arklidę [vieta]
```

**Demo struktūra (15 min):**
1. (3 min) Klausimas: "Kaip dabar valdai pamokas, mokėjimus, arklių darbą?"
2. (5 min) Show: Calendar drag → lesson, horse workload widget, payment 1-click
3. (2 min) Pricing + 14d trial
4. (5 min) Klausimai

**Conversion target:** 8 demos → 5 design partners (free 6mo Pro) → 3 convert į paid po 6mo. Plus referrals.

### 5.5 Content kalendorius (Sprint 5+)

| Sav | Blog | Instagram | Email | YT |
|---|---|---|---|---|
| 1 | "Whatsapp arklidei: 5 priežastys kodėl tai nebeveikia" | 3 (story + screenshot + tip) | Welcome series | — |
| 2 | "Kaip neperkrauti arklio: practical guide" | 3 | Trial-ending nudge | Demo: schedule lesson |
| 3 | "GDPR Lietuvos arklidėms — what actually applies" | 3 | Weekly digest | Demo: payment tracking |
| 4 | "Pirmieji 30 dienų skaitmeninėj arklidėj — case study" | 3 | Customer story | Demo: workload alert |
| 5 | "Excel vs Stable OS: side-by-side" | 3 | Activation milestone | — |

---

## 6. Pricing & monetizacijos detalės

Aš nieko nekeičiu plane (master.md 2.2). Bet pridedu *taktinius layerius*, kurie didina rev per customer.

### 6.1 Plan structure

| Tier | Mo | Annual (-20%) | Limits | Veikia |
|---|---|---|---|---|
| Starter | €19 | €182 | 10 horses, 30 clients, 1 trainer | Pradedantiems |
| **Pro ⭐ anchor** | **€49** | **€470** | 40 horses, 200 clients, 5 trainers, workload, portal, SEPA | ICP |
| Premium | €99 | €950 | Unlimited + multi-location, white-label, API | Tikslinė growth |

### 6.2 Add-ons (multiplikuoja ARPU)

| Add-on | Price | Margin |
|---|---|---|
| SMS reminders (200/mo) | +€9/mo | ~70% (Twilio passthrough) |
| White-label client portal | +€19/mo | ~95% |
| Custom domain on portal | +€9/mo | ~90% |
| Priority support (4h response) | +€19/mo | ~100% |
| Data import service (one-time) | €99 | scoped service |

**Realistic ARPU lift:** Pro €49 + 1 add-on (~€12 average) = **€61 effective ARPU**. Tai +24% vs base pricing.

### 6.3 Trial mechanika

- 14 days, no credit card
- Full Pro features
- Day 7 email: "How's it going? Need help?"
- Day 12: trial-ending nudge + checklist "ready to upgrade?"
- Day 14: read-only mode (data saugoma 30d, jei sugrįš)

### 6.4 Annual incentive

- Annual = -20% (€470 vs €588)
- Annual offer pasirodo dieną 10 trial'o
- Annual conversion ≈ 25-35% Pro paying base
- LTV efektas: +60% vs monthly

### 6.5 Dunning

| Day | Action |
|---|---|
| 0 (failed payment) | Email: "Card declined, please update" + Stripe Customer Portal link |
| 3 | Retry + email |
| 7 | Retry + downgrade to read-only mode |
| 30 | Final email + cancel subscription |

---

## 7. KPI dashboard ir savaitinis ritmas

### 7.1 Metrics, kuriuos žiūrim kas pirmadienį

```
Pirmadienis 09:00 — 30 min review (vienas)
- WAS (Weekly Active Stables)
- New trial signups (last 7d)
- Trial → paid conversion (cohort 30d ago)
- MRR + churn
- Top 3 user feedback themes
- Sentry errors (any new?)
- Decision: kas šios savaitės #1 tikslas?
```

### 7.2 Keturi savaitiniai ritualai

1. **Pirmadienis 09:00** — KPI review (30 min, solo)
2. **Trečiadienis 14:00** — Office hours su design partners (1 val, group call)
3. **Penktadienis 16:00** — Cold outreach session (2 val, 5 stables/sav)
4. **Sekmadienis 19:00** — Content batch — 3 IG posts + 1 blog draft (2 val)

### 7.3 Aktyvinimo funnel'is (cohort kiekvieną savaitę)

```
Landing visit
  ↓ 8% (target)
Signup
  ↓ 70%
Activated (created 1 horse + 1 client)
  ↓ 50%
Engaged (created 5+ lessons)
  ↓ 40%
Hit value (created 1 payment + workload viewed)
  ↓ 18%
Paid trial conversion
```

Bet kuriame žingsnyje <50%? Tai sprint'o priority.

---

## 8. Risk register & decision points

| # | Rizika | Kada matosi | Mitigation | Trigger to act |
|---|---|---|---|---|
| 1 | Founder nenaudoja produkto pats | Wk 8 | Daily commitment, savaitinė review | Wk 8: <80% lessons per app → STOP build, fix product |
| 2 | Trial konversija <10% | Po cohort #2 | Onboarding rework, upgrade prompts | Sprint 5 gale: <10% → freeze new features, fix activation |
| 3 | Cross-tenant data leak | Bet kada | RLS testai po every DB change | 1 incident: public report + halt features |
| 4 | Founder >50h/sav | Bet kada | Kalendoriaus boundaries, Sun off | 2 weeks @ >50h → priverstinis 1 wk off |
| 5 | Niekas iš design partners nemoka po 6mo | Wk 26 | Conversion checkpoint Wk 20 | Wk 20: 0/5 ready to pay → product gap, stop sales |
| 6 | Stripe / Supabase outage | Bet kada | Status page, manual reconciliation runbook | 4h+ outage → public status post |
| 7 | LT market per mažas | Wk 30+ | PL launch ready Sprint S6+ | <€2k MRR @ wk 30 → start PL outreach |
| 8 | Burnout | Wk 16+ | Sun off, workouts kalendoriuje | 2 missed Sundays → 1 wk full break |

### Decision gates (pre-set, kad nesvarstytum karštą galvą)

| Wk | Gate | Continue if | Adjust if | Stop if |
|---|---|---|---|---|
| 8 | Self-use validation | 80%+ daily on app | 50–80%: extend Sprint 0 | <50%: stop, rebuild basics |
| 13 | First revenue | €400+ MRR, 10+ paying | €100–400: adjust pricing/positioning | €0: 4-week sales sprint, then re-evaluate |
| 26 | Phase 3 entry | €1.3k MRR, 35+ paying | €500–1.3k: extend Phase 2 | <€500: post-mortem, consider non-tech co-founder |
| 52 | Year 1 review | On track | Below by 30%: re-plan | <€500 MRR: stop new acquisition |

---

## 9. Šios savaitės action items (top 7)

Tai tikrasis "ką darau dabar" sąrašas. Viskas iš plano nereikia šiandien.

1. ☐ **Custom domain setup** (`app.stableos.lt` arba `.com`) — 30 min
2. ☐ **Sentry account + integration** — 30 min
3. ☐ **Empty-state wizard** prototipas (Calendar puslapyje) — 4 val
4. ☐ **Pradėti naudoti app savo arklidėje** — kasdien, įsipareigojimas iki wk 8
5. ☐ **Outreach list draft** (10 stables, IG profiliai, owner names) — 1 val
6. ☐ **Stripe account + Test mode setup** (kol nepradedam Sprint 1, bet account ready) — 30 min
7. ☐ **Pirmas Instagram post** "Building a stable management app — week 1" — 1 val

**Šios savaitės tikslas:** užbaigti #1, #2, #3, #4 + bent #6 ir #7. Po to penktadienis = Sprint 0 demo sau pačiam.

---

## 10. Closing

Trys mintys, kurios laiko visą planą kartu:

1. **Distribution > features.** Daugiau klientų ne nuo daugiau funkcijų — nuo 5 realių pokalbių per savaitę. Code velocity dabar nėra problema.
2. **Naudok pats.** Jei tu pats neatidarinėji app kasdien — niekas neatidarinės. Tai #1 indikatorius.
3. **Boring sustainability.** 90 dienų be hero moves. 3 IG posts/sav, 5 outreach DMs/sav, 1 demo/sav, kasdienis use. Compound efektas — vienintelis dalykas, kuris veikia šitame nišiniame markete.

> *"Niekas nedaro stable management app gerai todėl, kad niekas iš stable owners nemoka coding. Tu esi vienas iš nedaugelio. Šitas pranašumas neamžinas — naudok jį per ateinančius 24 mėnesius."* — iš tavo verslo plano

---

*Šitas dokumentas live. Atnaujinti penktadienių pabaigose. Sprint review = update Sprint X status + plan Sprint X+1 top 3.*
