# Longrein — Founder Operational Dashboard
**Versija:** 1.0 LOCKED
**Sukurta:** 2026-05-05
**Tikslas:** 1-page weekly tracker, 30 min Monday morning ritual
**Replaces:** Ad-hoc metrics tracking, prielaidų vairavimas, "kaip jausis"

---

## TL;DR — Kodėl reikia šio dashboard'o

Tu dabar turi 23 strateginius dokumentus, Master Calendar, Financial Model, FM Customer Success Playbook. Visi jie aprašo **kur eini**. Šis dashboard'as atsako į vienintelį klausimą: **"Ar šią savaitę esu trake, ar nuvažiavau?"**

Be jo — vairuoji be greitomačio. Su juo — kiekvieną pirmadienį 30 min žinai:
- Kuri 1 metrika lūžta — ir ką darai šią savaitę
- Kur esi vs Master Calendar gates (M3 / M6 / M9 / M12)
- Ar burnout signaluoja (Personal Sustainability Plan integration)
- Kur 80/20 — kurią vieną veiklą daryti šią savaitę

**Vienas A4 puslapis. Pildyti pirmadienį 8:00–8:30 prie kavos. Niekada nepraleisti.**

---

## SEKCIJA 1 — Savaitės kontekstas (top of page)

```
┌─────────────────────────────────────────────────────────────────┐
│  SAVAITĖ #__ (M__ )       Datos: ____ — ____      Year ____    │
│  Master Calendar fazė: _____________________________________     │
│  Šio mėnesio P0 prioritetas: ________________________________    │
└─────────────────────────────────────────────────────────────────┘
```

**Pildoma kiekvieną pirmadienį, 30 sek darbas:**
- Savaitė # nuo launch'o (Week 1 = May 23–29, 2026)
- M__ = mėnuo nuo launch (M0 = May 2026, M12 = May 2027)
- Master Calendar fazė: copy/paste iš Master Calendar dokumento (pvz., "Pre-launch ramp" / "FM onboarding sprint" / "M3 retention gate")
- P0 prioritetas: vienintelė veikla, kuri jeigu neįvyks — savaitė nuvažiavo

---

## SEKCIJA 2 — North Star metrika (1 didelė skaičius savaitei)

```
┌─────────────────────────────────────────────────────────────────┐
│                  NORTH STAR ŠIANDIEN                             │
│                                                                  │
│         ___________________________________________              │
│         (pvz., "MRR €1,250" arba "8/10 FM aktyvūs")             │
│                                                                  │
│  vs. praeita savaitė: ▲▼ ___ %                                  │
│  vs. M__ tikslas:     ▲▼ ___ %                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Kaip parinkti North Star pagal fazę:**

| Fazė | Mėnuo | North Star metrika | Šaltinis |
|---|---|---|---|
| Pre-launch | M0 (May 1–22) | Founding Members confirmed (target 10) | FM Pack |
| FM onboarding | M1 (May 23 – Jun 22) | Active FMs (target 9/10 in week 4) | FM CS Playbook |
| Retention proof | M2–M3 | % FMs logging weekly (target 80%+) | FM CS Playbook |
| Conversion | M4–M9 | Paid customers # (target +1/mėn) | Financial Model |
| Scale | M10–M12 | MRR (target €3,045 by M12) | Financial Model |
| DACH prep | M13–M18 | DE qualified leads | DACH Playbook |
| DACH expand | M19+ | DACH MRR | DACH Playbook |

**TAISYKLĖ:** 1 North Star. Ne 3. Jei pildai 3 — neturi jokios.

---

## SEKCIJA 3 — Verslo metrikos (3 stulpeliai × 5 eilutės)

```
┌──────────────────┬──────────────────┬──────────────────┐
│   PIPELINE       │   PRODUCT        │   FINANSAI       │
├──────────────────┼──────────────────┼──────────────────┤
│ FM trial:    __  │ DAU/WAU:    __ % │ Cash:        €__ │
│ Demos sched: __  │ Horses on:  ___  │ MRR:         €__ │
│ Demos done:  __  │ NPS:         __  │ Burn:        €__ │
│ Paid signup: __  │ Bug count:  ___  │ Runway:    __ mo │
│ Lost/churn:  __  │ Uptime:    __ % │ AR overdue: €__ │
└──────────────────┴──────────────────┴──────────────────┘
```

### PIPELINE stulpelis — paaiškinimai

- **FM trial:** kiek FMs šiuo metu free 12 mo trial'e (target 8–10 visa Year 1)
- **Demos scheduled:** kiek kalendoriuje šią savaitę
- **Demos done:** kiek faktiškai įvyko per praeitą savaitę
- **Paid signups (this week):** nauji paying customers per savaitę
- **Lost/churn:** kas išėjo arba pasakė "ne ačiū" — su priežastimi šalia (1 žodis: kaina/funkcija/timing)

**Threshold alertai:**
- Demos done = 0 dvi savaites iš eilės → P0 sales aktivacija (cold outreach 20 stables)
- Lost/churn ≥ 2 / mėn → P0 root cause analysis (Customer Success Playbook page X)
- Paid signups = 0 keturias savaites iš eilės M6+ → ICP recalibration trigger

### PRODUCT stulpelis — paaiškinimai

- **DAU/WAU:** Daily Active Users / Weekly Active Users (proxy for stickiness, target ≥40%)
- **Horses on platform:** total # horses created across all customers (revenue driver per €3/horse)
- **NPS:** rolling 30-day score (skaičiuoti per kvartalo galą, žymėti tik kai šviežias)
- **Bug count:** open bugs reported per FMs (target ≤5 chronically open)
- **Uptime:** % per praeitą 7d (Vercel/Supabase dashboards)

**Threshold alertai:**
- DAU/WAU < 30% du mėnesius iš eilės → P0 retention diagnostic
- Horses on platform plateau M4+ → expansion problem (current customers nepriduria žirgų)
- Uptime < 99% mėnesį → infrastruktūros prioritetas Q+1

### FINANSAI stulpelis — paaiškinimai

- **Cash:** Revolut Business + asmeninis buffer (real money today)
- **MRR:** Stripe MRR (auto-pull) — paid customers tik, ne FMs
- **Burn:** mėnesio expenses (hosting, tools, ads, consultants)
- **Runway (months):** Cash / Burn (jeigu MRR < Burn) arba "infinite" (jeigu MRR > Burn)
- **AR overdue:** invoices overdue 30+ days (target €0 always)

**Threshold alertai:**
- Runway < 6 mo → P0 emergency mode (cut burn arba accelerate revenue)
- Runway < 3 mo → P0 active fundraise / personal funding decision
- AR overdue > €0 dvi savaites → P0 collections call (don't be polite, be paid)

---

## SEKCIJA 4 — Marketing metrikos (mini panelis)

```
┌─────────────────────────────────────────────────────────────────┐
│ MARKETING SAVAITĖS PULSE                                         │
├─────────────────────────────────────────────────────────────────┤
│ IG followers:    ___  (vs M__ target: ___) ▲▼ ___              │
│ IG reach 7d:    ____  IG saves 7d: ___ (saves = intent signal) │
│ Landing visits: ____  Sign-up rate: __ %                       │
│ Posts shipped:  __ /5 (target 5 IG + 1 YouTube + 2 LinkedIn/wk)│
│ Email list:    ____  (waiting list growth)                      │
└─────────────────────────────────────────────────────────────────┘
```

**Threshold alertai:**
- IG followers < 80% of monthly target dvi savaites iš eilės → content pivot arba paid boost
- Sign-up rate < 5% landing'e → copy/headline rewrite required
- Posts shipped < 4/savaitę du mėnesius → automation/batch system reikia (nesi disciplined enough manually)

---

## SEKCIJA 5 — Asmeninė metrika (Personal Sustainability integration)

```
┌─────────────────────────────────────────────────────────────────┐
│ ASMENINĖ DARNA — pildoma pirmadienio rytą už praeitą savaitę   │
├─────────────────────────────────────────────────────────────────┤
│ Hours worked (Longrein):     __ /65 max                         │
│ Hours TJK (stable ops):      __  (typically 21h fixed)          │
│ Sleep avg:                   __ h/night (target ≥7)             │
│ Riding sessions:             __ /2 protected (Wed + Sat)        │
│ Days off (no Longrein work): __ /1 (Sunday must be 0)           │
│                                                                  │
│ Burnout pulse (1-10):  Energy ___  Cynicism ___  Efficacy ___  │
│ Red flag ar žaliai? 🟢 / 🟡 / 🔴                                │
└─────────────────────────────────────────────────────────────────┘
```

**Burnout pulse skaičiavimas (Maslach proxy):**
- Energy: 10 = "I'm fired up", 1 = "I'm exhausted on Monday already"
- Cynicism: 10 = "Customers are amazing", 1 = "I hate the customers I'm building for"
- Efficacy: 10 = "Crushing it", 1 = "Nothing I do works"

**Threshold alertai (mandatory action):**
- 🔴 RED jeigu: bet kuri pulse < 4 dvi savaites iš eilės **ARBA** hours > 65 tris savaites iš eilės **ARBA** Sunday off = 0 dvi savaites
  - **AKTIVACIJA:** Sustainability Plan section 9 — "When red, scale Longrein down 30% for 1 week. No exceptions."
- 🟡 YELLOW jeigu: 1 metrika nukrypsta nuo tikslo savaitę
  - **AKTIVACIJA:** review Sustainability Plan, identify which boundary slipped, recommit
- 🟢 GREEN: visi 5 OK, pulse ≥6, hours ≤65, riding done, Sunday off

**Šis blokas yra dashboard'o širdis. Verslo metrikos meluoja arba uždelsia. Burnout — niekada.**

---

## SEKCIJA 6 — Šios savaitės 1 sprendimas

```
┌─────────────────────────────────────────────────────────────────┐
│ SHIP THIS WEEK (1 thing only)                                    │
│                                                                  │
│ Įsipareigojimas:                                                │
│ ____________________________________________________________   │
│                                                                  │
│ Iki kada (savaitės data):  ____________                          │
│                                                                  │
│ Sėkmės kriterijus (binary, taip/ne): _________________________  │
└─────────────────────────────────────────────────────────────────┘
```

**Taisyklė:** 1 daiktas. Ne 3. Ne 5. **1.**

Pavyzdžiai gerų savaitės įsipareigojimų:
- "Onboard FM #5 (Žemaitijos JK) iki Šeštadienio 17:00"
- "Publish YouTube #3 + 5 IG posts + 2 LinkedIn posts iki Sekmadienio"
- "Atsiųsti renewal kvietimą visiems M3 baigiantiems FMs su €2.25/horse offer"

Pavyzdžiai blogų (per platūs / 3-in-1):
- "Improve marketing" (per platus)
- "Launch + content + onboarding" (3 daiktai)
- "Hopefully close 5 customers" (no binary criteria)

---

## SEKCIJA 7 — Sprendimų gates'ai (kvartalinis check, pildoma 1× per ketvirtį)

```
┌─────────────────────────────────────────────────────────────────┐
│ KETVIRČIO GATE STATUS  (pildoma M3, M6, M9, M12, M15, M18...) │
├─────────────────────────────────────────────────────────────────┤
│ Gate: M__                                                        │
│ Date: ____                                                       │
│                                                                  │
│ Pass criteria pasiekti?                                          │
│  □ MRR target: €__ vs actual €__                                │
│  □ Customers: __ vs actual __                                    │
│  □ NPS: __ vs actual __                                          │
│  □ Founder hours sustainability: ≤65/wk avg                     │
│                                                                  │
│ Decision:  □ CONTINUE  □ PIVOT  □ KILL                          │
│ If PIVOT — what changes (1 sentence): ________________________  │
└─────────────────────────────────────────────────────────────────┘
```

**Master Calendar gates:**
- **M3 (Aug 23, 2026):** Retention gate — 8/10 FMs aktyvūs? Jei ne → ICP klaida.
- **M6 (Nov 23, 2026):** Conversion proof — 2+ paid customers? Jei ne → pricing/messaging klaida.
- **M9 (Feb 23, 2027):** Pricing recalibration — €3/horse veikia? Customer #10 milestone reached?
- **M12 (May 23, 2027):** Year-1 verdict — €36K ARR + 35 customers? Continue Year 2 / pivot / kill.
- **M18 (Nov 23, 2027):** DACH-ready? Domain authority, EN docs, DE-native hire pipeline?

**Gate'as yra committee meeting su pačia savimi.** Jeigu actuals < 70% target — ne grąžinama "geresne savaite," priimama sprendimas.

---

## SEKCIJA 8 — Apačioje (Notes & Next Week Priors)

```
┌─────────────────────────────────────────────────────────────────┐
│ NOTES — kas keista, ko nesuprantu, kam reikia investigation     │
│ ____________________________________________________________   │
│ ____________________________________________________________   │
│                                                                  │
│ KITA SAVAITĖ — top 3 risks                                       │
│ 1. _________________________________________________________   │
│ 2. _________________________________________________________   │
│ 3. _________________________________________________________   │
└─────────────────────────────────────────────────────────────────┘
```

---

## DASHBOARD'O NAUDOJIMO RITUALAS

### Pirmadienio rytas — 30 min, 8:00–8:30

**8:00–8:05** — Atidaryk dashboard'ą (template'as Notion/Google Doc/Excel — tu pasirenki)

**8:05–8:15** — Pull metrikas (10 min):
- Stripe → MRR, churn, paid signups
- Vercel/Supabase → uptime, DAU
- IG/LinkedIn analytics → followers, reach, posts
- Bank account → cash position
- Toggl/manual log → hours worked savaitę
- Calendar → riding sessions done

**8:15–8:25** — Analizė (10 min):
- Bet kuris alertas? (raudonos thresholdo eilutės?)
- Burnout pulse — žalia/geltona/raudona?
- Master Calendar — kur šios savaitės fazė?
- Kas šios savaitės P0?

**8:25–8:30** — Įsipareigojimas (5 min):
- Sekcija 6 užpildyta? 1 daiktas, deadline, binary criterion?
- Kalendoriuje block'as šio P0 darbui?

### Sekmadienio vakaras — 10 min retro

**21:50–22:00** — Užbaik praeitos savaitės dashboard'ą:
- Sekcija 5 (asmeninė) — pildoma už praeitą savaitę
- Sekcija 6 — pažymėk Pass/Fail šios savaitės įsipareigojimą
- Sekcija 8 (notes) — kas nutiko netikėto?

### Mėnesio paskutinis pirmadienis — 60 min monthly review

**8:00–9:00** — Visas mėnuo overview:
- 4 savaitės dashboard'ai šalia vienas kito
- Trend lines: MRR, customers, hours, IG followers
- Master Calendar — ar šis mėnuo atitiko planą?
- Ką keisti kitą mėnesį (1 systemic change, ne taktinis)

### Ketvirčio gate — 2h decision meeting su pačia savimi

**3-os mėnesio paskutinis pirmadienis** — Section 7 pildymas + decisions:
- M3, M6, M9, M12, M15, M18 — be šių sprendimų strategija drift'ina
- 2 valandos protected time, telefonas off, kaip board meeting

---

## TEMPLATE'AS — kur laikyti

**Rekomendacija (priority order):**

1. **Excel weekly tracker** (Year 1 prefer) — viename file'e visi 52 savaitės tab'ai, formula auto-skaičiuoja MRR delta, charts auto-update. Aš galiu sukurti šitą `Longrein-Weekly-Dashboard-Year1.xlsx` jei pasakysi.

2. **Notion** — gražus visual, mobile prieinamas, bet manual data entry sluggish jei ne power user.

3. **Google Sheets** — tarp Excel'o ir Notion'o. Auto-sync su Stripe/Vercel reikia setup'o.

4. **Print A4 popierius** — guerrilla mode. Pildai ranka, klijuoji ant sienos, žinai status'ą be screen'o. Mažiausiai data, daugiausiai discipline.

**Mano patarimas:** Excel Year 1, kai workflow'as nusistovės M6+ — galima migruoti į Notion jei nori dashboards prieš customers/team rodyti.

---

## INTEGRATION SU KITAIS DOKUMENTAIS

Šis dashboard'as yra **operacinis sluoksnis** virš strateginių dokumentų:

| Dashboard'o sekcija | Šaltinio dokumentas |
|---|---|
| North Star (Sec 2) | Master Calendar phase + Financial Model targets |
| Pipeline (Sec 3) | FM Pack ICP scoring + Customer Success Playbook |
| Product (Sec 3) | Readiness Audit + Onboarding SOP |
| Finansai (Sec 3) | Year-1 Financial Model auto-pull |
| Marketing (Sec 4) | IG targets memory + Channel Strategy |
| Asmeninė (Sec 5) | Personal Sustainability Plan |
| Ship This Week (Sec 6) | Master Calendar mėnesio P0 |
| Gates (Sec 7) | Master Calendar decision points |

**Be dashboard'o:** 23 dokumentai = teorija.
**Su dashboard'u:** 23 dokumentai = veikiantis sistema.

---

## ANTI-PATTERNS — ko nedaryti

❌ **Pildyti tik kai jausies gerai.** Disciplina — pildyk net blogą savaitę, ypač blogą savaitę.

❌ **Pridėti daugiau metrikų.** Šis dashboard'as MAX. Jei nori naujos — pakeisk seną. Limit = 1 puslapis.

❌ **Per detali analizė.** 30 min pirmadienio rytas. Ne 3 valandos. Pulse check, ne audit.

❌ **Skip Sec 5 (asmeninė).** Tai pirmas dashboard'as kurį skip'ini kai stress'as. Tai paskutinis kurį turėtum skip'inti.

❌ **Dalintis su FMs.** Šis yra TAVO dashboard'as. FM customer health metrics yra atskirame FM CS Playbook'e. Nesumaišyk.

❌ **Komentuoti emocijas.** "I feel like..." — nereikia. Faktai + sprendimai. Emocijos eina į Sustainability Plan journal'ą.

❌ **Atidėti sprendimus į Q+1.** Gate'as triggeris veiksmą — ne "stebėsim toliau."

---

## SUMMARY — vienas paragrafas

Pirmadienį 8:00 atsidarai 1-page dashboard'ą. Užpildai 12 metrikų (10 min), patikrini ar burnout žalia (5 min), parinkti 1 P0 šiai savaitei (5 min), užrakini kalendoriuje (10 min). 30 min, kiekvieną savaitę, 52 savaites/metus = 26h/year discipline overhead = 0.5% tavo darbo laiko, kuris vadovauja kitiems 99.5%. Be šio 0.5% — kiti 99.5% drift'ina pagal urgent, ne important. Su šiuo 0.5% — Master Calendar plan'as faktiškai vyksta.

---

## FILES TO CREATE NEXT (jei tęsiam)

Po šio dashboard'o logical next:
- **G.1) `Longrein-Weekly-Dashboard-Year1.xlsx`** — actual fillable Excel template (52 weekly tabs, formulas, charts auto-update)
- **G.2) `Longrein-Monthly-Review-Template.md`** — mėnesio retro structured doc
- **G.3) `Longrein-Quarterly-Gate-Decision-Doc.md`** — gate'o sprendimo template

---

**Prepared:** 2026-05-05
**Owner:** Andreja
**Update cadence:** Q1 review (2026-08-23 / M3 gate)
**Status:** v1.0 LOCKED — naudotina nuo Week 1 (2026-05-23)
