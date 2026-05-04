# Longrein — DACH Expansion Playbook

**Klausimas:** Kaip Longrein eina į Vokietija / Austrija / Šveicarija (DACH) rinką ir realizuoja vertę iš tos rinkos solo bootstrap'eriu?
**ARR impact estimate:** +€650K–€900K Year 5 ARR vs. „Baltic + Polish only" plan'as. Tai vienintelis play'us, kuris perveda Longrein iš lifestyle SaaS (~€874K) į milijonine (€1.5M+).
**Kritinis insight:** DACH yra Europos didžiausia equestrian rinka, bet gali sutraiškyti tave, jei eini per anksti arba be tikslios localization'os.

---

## TL;DR

DACH rinka yra **6× didesnė** už mūsų Baltic + Polish combined market'ą. 8,000–9,000 commercial stables. Premium pricing tolerance. GDPR-native culture. Bet language barrier'as, 6-12 mėn. sales cycles, established US competitors su regional distributors.

**Mano sprendimas: M18+ entry, NE anksčiau.** Kelios priežastys:
1. Iki M18 — Baltic+Polish saturation @ 50–80 customers, refined product, fundable case studies
2. DE B2B SaaS sales cycles 2–3× ilgesni nei LT — solo founder'iui per skausmingu earlier
3. DE customers reikia DE-native onboarding (NE translated) — reikia hire pirmo team narė (€40–60K/yr full-time)
4. Lingvistinė + cultural localization yra 4–6 mėn. darbas (ne savaičių)

**Realistic DACH path:**
- M18: Soft entry — German-language landing page + 1 DE reference customer + FN federation kontaktas inicijuotas
- M24: Full launch — DE customer success rep hired + 5 paying customers DE
- M36: 50 paying customers DE + AT/CH pivot
- Year 5: 300+ paying customers DACH = ~€350K incremental ARR

**Critical: NEturim daryti šios klaidos** — vertical SaaS company entering DACH without DE-native team narė. 90% case studies — failure'as. Komentaras kiekvienam DACH customer'iui per Zoom su accent'u = trust signal'as. Be jo brand'as nukenčia per pirmus 5 customer'ius.

---

## Dalis 1 — DACH market sizing

### Vokietija (DE) — primary target

- **8,000+ commercial stables** (per FN — Deutsche Reiterliche Vereinigung)
- ICP fit (15–60 horses, professional ops): ~3,000 stables
- Major pferdesport regions: NRW, Bayern, Niedersachsen, Baden-Württemberg
- TAM (DE alone): €1.5M+ ARR potential

### Austrija (AT) — secondary

- ~600 commercial stables
- Strong overlap with DE culture/language
- ICP fit: ~150 stables
- TAM (AT): €300K ARR potential

### Šveicarija (CH) — tertiary, premium

- ~400 commercial stables
- Premium pricing tolerance (CH purchasing power 2× DE)
- ICP fit: ~120 stables
- Currency complexity (CHF, not €) — defer to M36+
- TAM (CH): €400K ARR potential (charged in € — NE CHF localization to start)

### Total DACH

- Combined ICP-fit: **~3,300 stables**
- Combined TAM (5-year horizon): **€2.0M+ ARR potential**
- Realistic SOM @ 5 years (10% saturation): **~€500–800K ARR from DACH alone**

For comparison:
- Baltic+Polish ICP: ~700 stables, TAM €700K
- DACH ICP: 3,300 stables, TAM €2M
- **DACH is 3× the addressable market in same currency, with 2× pricing tolerance.**

---

## Dalis 2 — Why DACH is hard (honest assessment)

### Language

DE-language is NON-NEGOTIABLE. „We support German" via Google Translate ≠ supporting DE customers. They will not buy.

What must be DE-native:
- Landing page copy (every word — original DE writing, NOT translated from EN)
- App UI (every label, button, error message — DE-native)
- Email templates (welcome, password reset, billing — DE)
- Help docs (most popular 30+ articles)
- Support response language (DE first response within 4 hours)
- Sales materials (PDF, deck, FM offer)
- Legal docs (DE-language Terms, Privacy, AGB)

This is 200–400 hours of native DE writing/review work. Cost €5,000–€15,000 one-time + ongoing.

### Sales cycle length

DE B2B SaaS purchasing typical:
- LT/PL: 1–4 weeks (small business, owner decides)
- DE: 6–12 weeks (more deliberation, references checked)
- DE enterprise (50+ horse yard, Verein with multiple stakeholders): 3–6 months

Solo founder doing 30 DACH demos = 200+ hours of sales work over 3–6 months. Currently ~50% of Andreja's bandwidth at peak. NOT sustainable solo.

### Trust requirements

DE buyers need:
- 1+ DE reference customer (named, photo, public)
- 1+ media mention in DE equestrian press (Pferdesport, Reiter Revue, St. Georg)
- DE-language support phone number (NOT just email)
- DE-domain email (longrein.de, NOT longrein.eu — for trust)
- Compliant DSGVO (German GDPR) badge on website
- VAT MOSS (or German VAT registration) for B2B billing

### Competitive landscape

Established competitors in DE:
- **Equiwise** — German-built, 2018, ~500 customer'ių. Direct competitor. Strong distribution via Verein-ähnliche structures.
- **PferdeManagement.de** — small but established, ~200 customer'ių. Less feature-rich than Longrein.
- **Equine Genie / Stablebuzz** — US players with German distributors. Less native, but more capital.

We are NOT entering an empty market. We are entering a contested market where incumbents have 3–5 year head start.

### Compliance complexity

DE has stricter compliance than LT/PL:
- **XRechnung** — mandatory e-invoicing format for B2B since 2025. Longrein needs XRechnung export.
- **DSGVO** — stricter than baseline GDPR (Bundesdatenschutzgesetz). Need DE legal review.
- **Reiterzeugnis-compliance** — riding instructor licensing data integration (DE has license categories)
- **VAT registration** — €22K threshold, then mandatory DE VAT registration if B2B selling

Plus AT and CH each have their own VAT/data laws.

---

## Dalis 3 — Prerequisites (MUST be true before DACH entry)

These are NON-negotiable. If any single one is missing at M18, push DACH to M24.

### Product prerequisites

- [ ] **i18n architecture in code** — `next-intl` or equivalent, all strings extracted to JSON
- [ ] **Multi-currency support** — EUR primary; CHF preparation OK
- [ ] **DE date/time formatting** — DD.MM.YYYY, 24h time
- [ ] **DE address format** — Straße, Hausnummer, PLZ, Ort
- [ ] **XRechnung export** for B2B invoicing
- [ ] **DSGVO-compliant data residency** — confirmed EU-only via Supabase EU region
- [ ] **DE language pack** v1.0 — full UI translation by native speaker

**Estimated lead time: 4–6 mėn. of dev work.** Start preparation M12.

### Market prerequisites

- [ ] **30+ paying customers in Baltic+Polish** by M18 (proves PMF)
- [ ] **2+ named case studies** with quantified ROI (one Baltic, one Polish)
- [ ] **At least 1 DE reference customer** ready to publicly endorse (recruit M14–M16, before public DACH push)
- [ ] **€100K+ in cash runway** OR €5K+ MRR (gives buffer for slow DACH ramp)

### Team prerequisites

- [ ] **At least one DE-native team member** (full-time or 60%+ part-time, NOT freelancer)
- [ ] **DE-language customer support** flow operational
- [ ] **DE-language sales materials** (deck, PDF, FM offer, demo script) ready

**Hire timing: M14–M16.** DACH cannot scale without this.

### Operational prerequisites

- [ ] **longrein.de domain** purchased + DNS set up (defensive — buy NOW even if not using)
- [ ] **AT, CH equivalents** — longrein.at and longrein.ch — defensive purchases
- [ ] **DSGVO-compliant DPA** template (DE-language)
- [ ] **DE entity considered** — UAB Longrein owns IP, but optional GmbH or UG for DE billing convenience

---

## Dalis 4 — DACH localization plan

### Phase 1 (M12–M16): Foundation

- M12: Buy longrein.de, .at, .ch domains. Defensive, no DNS routing yet.
- M13: Implement i18n architecture in app codebase
- M14: Hire DE-native team member (full-time or 60% part-time)
- M14: Begin app UI translation (estimated 200 strings + variants)
- M15: Begin landing copy (NEW DE writing — not translated, founder + DE team member co-author)
- M16: DE-language Terms, Privacy, AGB review by DE legal counsel (~€2,000)

### Phase 2 (M16–M18): Soft launch

- M16: Publish DE landing at longrein.de (waitlist mode — no app access yet)
- M16: Begin DE-language LinkedIn posts from founder profile (1×/sav.)
- M17: Recruit 1–2 DE „Founding DACH Member" candidates (warm intros via FN connections, vet partnerships from M9 phase)
- M17: Schedule first DE demo calls (Andreja + DE team member, both attend)
- M18: First DE Founding DACH Member onboarded (1 customer, white-glove) — NEPRADEDAM mass entry

### Phase 3 (M18–M24): Public DACH launch

- M18: Public DACH announcement (DE press kit, FN federation pitch initiated)
- M19–M24: Onboard 5 DE Founding DACH Members + start FN partnership negotiation
- M22: First DACH customer case study published (DE language, DE-native)
- M24: 5 paying DACH customers, FN federation deal in advanced stage

### Phase 4 (M24+): Scale

- M24+: FN federation partnership signed (if successful — 2,000+ member yards exposed)
- M30: AT entry (smaller, lighter — leverage DE infra)
- M36: 50+ DACH customers, ~€36K MRR from DACH alone

---

## Dalis 5 — Channel strategy in DACH

DACH is primarily channel-driven. Direct outreach has 3× lower conversion than channel-attributed in DE B2B.

### Primary channel: FN federation

- **Deutsche Reiterliche Vereinigung (FN)** — 8,000+ Verein members
- Negotiation timing: M18–M24
- Same template as LSF partnership (revenue share, member discount, co-marketing) — adjusted for DE scale
- Expected: 2–4% Year 1 penetration → 100–200 customers in 18 mėn.

### Secondary channel: Top vet clinics

DE top vet clinics (regional reach):
- **Pferdeklinik Lüsche** (Niedersachsen)
- **Tierärztliche Klinik für Pferde Telgte** (NRW)
- **Pferdezentrum Bad Saarow** (Brandenburg)
- (research full top 10 list during M14–M16 prep)

Vet partnership template same as LT — adjusted for scale.

### Tertiary channel: Equestrian magazines

- **St. Georg** (premier German pferdesport magazine, ~50K subscribers)
- **Reiter Revue International** (~80K subscribers)
- **Pferd & Sport** (~30K)

Sponsored content at €1,000–€3,000/article. NOT primary, but credibility-building.

### Quaternary channel: Equestrian YouTube creators

DE equestrian YouTube has top creators with 100K+ subscribers (Caro Klan, Anja Beran, Pferdiathek). Sponsored mention €500–€2,000. Lower-leverage but easy to start.

---

## Dalis 6 — Pricing in DACH

### NE darom DACH-specific pricing initially

Same per-horse model: €3.00/horse/mo, min €30, max €150, annual 25% off.

Reasoning:
- DE customers do NOT expect EU-uniform pricing (mostly)
- US competitors charge $24-30/mo flat — our €3.00/horse for 25-horse yard = €75/mo, similar territory
- Lokalizuota pricing complicates Stripe + revenue ops + fairness signaling

### Test premium tier in DACH (M30+)

After 30+ DE customers, test:
- **Longrein Pro DACH:** €4.50/horse, includes DE accountant integration (DATEV), XRechnung export, premium support
- Captures 30–50% of DE customers willing to pay premium
- Adds €50/customer/yr ARPU lift = +€15K ARR per 100 DACH customers

### CH special case

Swiss customers willing to pay 2× DE pricing for premium positioning. Optional **Longrein CH:** charged in CHF, ~CHF 5/horse (≈€5.20). Defer to M36+ when revenue/ops support multi-currency.

---

## Dalis 7 — Hiring plan

### M14: First DE-native hire

**Role:** „Customer Success & Localization Lead, DACH"
**Type:** 60–80% part-time OR full-time
**Location:** Remote (DE timezone)
**Comp:** €30K–€55K/yr (range for part-time → full-time)
**Background:** equestrian background preferred (rider, lower-level certified instructor) + B2B SaaS customer success experience
**Languages:** DE-native + EN fluent

**Responsibilities:**
- DE-language customer onboarding calls
- DE-language email support (4-hour SLA)
- DE-language content writing (landing, blog, social)
- DE customer feedback synthesis to founder
- Local DE network building (FN federation, vets, magazines)

**Why critical:** Solo founder doing DE accent without native co-pilot = trust killer. Even great DE language skills as a non-native don't pass „can I trust them with my livelihood" test for DE Mittelständler stable owner.

### M24: Second DACH hire (if hitting target)

If 30+ DACH customers by M24, hire:
- DE-native sales rep (commission-based, equestrian network)
- Or upgrade Customer Success Lead to Director role + hire CS Specialist

### M36: AT-specific hire (optional)

If AT becoming meaningful (15+ customers), part-time AT-native CS rep.

---

## Dalis 8 — Competitive positioning vs Equiwise + others

### Equiwise (primary DE competitor)

Equiwise yra DE-built, established 2018, ~500 customer'ių. Strengths:
- DE-native from day one
- Strong Verein integration
- DE customer trust

Weaknesses (vs Longrein):
- No welfare-first dashboard (welfare is reports tab)
- No founder-direct support (corporate help desk)
- Older UI (2018 design language)
- No European Union pan-EU positioning

**Our wedge against Equiwise:**
- „Welfare visible at top of dashboard, not buried in reports" — concrete, defensible
- „Built by a stable owner, available to your entire DACH region from day one" — narrative they cannot match
- „Modern UI matching what your clients expect from premium services" — soft but real

NEvariskime competitor'ių publicly. NE post'ai apie „Equiwise vs Longrein". Compete on positive positioning, ne attack.

### Equine Genie / Stablebuzz (US incumbents)

Strengths:
- Years of feature development
- Larger budget for marketing

Weaknesses (vs Longrein):
- US-built, retrofitted to EU
- No native DE language
- No DSGVO-native architecture
- No SEPA Direct Debit
- No XRechnung
- Time-zone offset for support

**Our wedge:** „European software, built where you live, in your language, complies with your laws — from day one, not retrofitted."

This is a strong wedge. DE customers value local-built software disproportionately to actual feature quality.

---

## Dalis 9 — Risk register

### Risk 1: DE language quality not native enough

- **Probability:** Medium (40%)
- **Impact:** High — kills trust on first impression
- **Mitigation:** DE-native hire (M14) reviews EVERYTHING customer-facing. NO Google Translate output ships.
- **Trigger to abort:** If first 5 DE demo'ai give „kažkas ne taip su jūsų vokiečiais" feedback.

### Risk 2: Solo founder bandwidth break

- **Probability:** High (60%)
- **Impact:** High — Andreja burns out trying to serve LT+PL+DACH simultaneously
- **Mitigation:** M14 hire is non-negotiable, NOT „nice to have"
- **Trigger to abort:** If working >55 val/sav. for 3+ consecutive weeks AND approaching DACH launch.

### Risk 3: Equiwise responds aggressively

- **Probability:** Medium (40%) — they're funded ~€2M Series A
- **Impact:** Medium — slows our growth in DE
- **Mitigation:** Don't engage in price wars. Focus on welfare wedge + EU-pan positioning.
- **Trigger to abort:** N/A — competitive pressure is normal.

### Risk 4: FN federation negotiation fails

- **Probability:** Medium (50%) — federations are political
- **Impact:** High — without FN, organic DACH growth caps at ~10–20 customers/yr
- **Mitigation:** Plan B = direct vet clinic partnerships + magazine sponsorships + Andreja DE conferences attendance
- **Trigger to abort:** If post-2 negotiation rounds, FN signals not interested. Pivot fully to vet+magazine channel.

### Risk 5: DACH currency / regulatory shift

- **Probability:** Low (15%)
- **Impact:** High — could force major rework
- **Mitigation:** Watch for DE B2B SaaS regulatory shifts (e-invoicing requirements, DSGVO updates). Annual review with DE counsel.

### Risk 6: First DE Founding DACH Member churns publicly

- **Probability:** Low (10%)
- **Impact:** Very High — public failure in DE press kills entry
- **Mitigation:** White-glove onboarding (Andreja + DE hire both present at first demo). Over-deliver on first FM. Buy them at restaurant if you have to. Their success = our market entry.

### Risk 7: DACH revenue too low to sustain DE hire

- **Probability:** Medium (35%)
- **Impact:** Medium — could force layoff or DACH freeze
- **Mitigation:** Conservative hire timing — 60% part-time at M14, scale to full-time only at M22 if 5+ DE customers.

---

## Dalis 10 — KPIs and decision points

### M18 (DACH soft launch)

- Targets:
  - 1 DE Founding DACH Member onboarded
  - DE landing page live, ~50 waitlist signups from DACH
  - FN federation initial conversation initiated
  - DE team member onboarded and operational

- **Decision:** if all 4 met → full launch M19. If <2 met → push to M24.

### M24 (full DACH push)

- Targets:
  - 5 paying DACH customers
  - 1 DACH case study published
  - FN federation deal in advanced stage OR fallback partnerships secured
  - DACH MRR ≥€500
  - DE customer 90-day retention ≥85%

- **Decision:** if 4+ of 5 met → continue scaling DACH. If <3 met → freeze new DACH acquisition for 90 days, focus on existing 5 + Baltic-Polish saturation.

### M36 (DACH scale)

- Targets:
  - 50 paying DACH customers
  - 30% of total customer base from DACH
  - DACH MRR ≥€4,000
  - 2 published partnerships (federation + vet OR magazine)

- **Decision:** if hit → AT expansion + CH preparation. If <60% met → reassess strategy with DE team member.

### Year 5

- Targets:
  - 300+ DACH customers
  - DACH = 50% of total customer base
  - DACH MRR ≥€25,000

- **Outcome scenarios:**
  - Hit: Total ARR ~€1.5M, milestones for either reinvestment OR distribution to founder
  - Miss by 30%: Total ARR ~€1.0M, still meaningful business, recalibrate growth strategy
  - Miss by 50%: Total ARR ~€700K, DACH was the wrong bet — focus exclusively on Baltic+Polish optimization

---

## Dalis 11 — Konkretūs šios sav. veiksmai (preparation work)

NE daromas DACH veiksmas ŠIANDIEN. Bet šie ruošimosi žingsniai prasideda M6+ (Lapkritis 2026):

### M6 (Lapkritis 2026) — Defensive purchases

- [ ] Pirkti `longrein.de`, `longrein.at`, `longrein.ch` (per Hostinger ar Cloudflare). Bendra kaina ~€40/yr. Tik defensive — neaktyvuojam DNS routing.

### M8 (Sausis 2027) — i18n architecture in app

- [ ] Implementuoti `next-intl` (or equivalent) Next.js app'e
- [ ] Extract'inti visus UI strings į `/messages/en.json`
- [ ] Setup'inti language switcher UI (visible in app footer)

### M10 (Kovas 2027) — DE-native talent search

- [ ] Identifikuoti 5 DE-native equestrian SaaS / customer success kandidatus per LinkedIn
- [ ] Pirmi „informational call" calls (NE hiring yet — relationship building)

### M12 (Gegužė 2027) — DE language pack v1.0

- [ ] Hire DE translator (€2,000–€4,000 one-time) for app UI translation
- [ ] Native DE speaker review (different person from translator) for quality check

### M14 (Liepa 2027) — First DE hire

- [ ] Public job posting for DE Customer Success Lead
- [ ] Interview pipeline (8–12 candidates → 3 finalists → 1 hire)
- [ ] Onboarding: 30 days as Andreja's shadow learning Longrein product + Trakų JK ops

### M16 (Rugsėjis 2027) — DE landing page

- [ ] Publish longrein.de waitlist landing
- [ ] Begin DE-language founder LinkedIn posts (1×/sav.)
- [ ] First DACH FM candidate calls

### M18 (Lapkritis 2027) — DACH soft launch

- [ ] First DE FM onboarded (white-glove, Andreja + DE hire both attend)
- [ ] DACH press release in DE equestrian magazines
- [ ] FN federation outreach initiated

---

## Dalis 12 — Honest assessment: does DACH make sense?

This is the section where I tell you what I actually think.

DACH is the **single biggest lever** for hitting €1.5M+ ARR. Without DACH, Longrein caps somewhere between €700K–€900K — solid lifestyle business, NOT „milijoninis."

DACH is also the **biggest risk to focus.** If you push DACH at M12 trying to be aggressive, you will sacrifice the LT+PL beachhead foundation that is the actual basis of your business. You'll be a mediocre player in 4 markets instead of dominant in 2.

The right answer is M18 entry — late enough that LT+PL is a fortress, early enough that competitors haven't fully locked in DACH.

The biggest variable is the team hire at M14. Solo founder doing DACH = death. Founder + 1 DE-native partner = serious shot at €1.5M+ ARR.

Everything else in this playbook is execution detail. The strategic decision is:
- **Are you willing to hire your first employee at M14?**
- **Are you willing to take 6 months of slower LT+PL growth to invest in DACH preparation?**

If yes — DACH is your path to milijonus.
If no — Longrein is a €700K lifestyle SaaS, and that is OK too.

This is your call.

---

*Šis dokumentas live'as. Atnaujinti M12 + M16 + M18 milestones. Įkelti į Drive `02_Product/strategy/`.*
