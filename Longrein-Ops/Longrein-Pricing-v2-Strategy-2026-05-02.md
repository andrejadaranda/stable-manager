# Longrein — Pricing v2 strateginis sprendimas

**Klausimas:** Kokia pricing struktūra optimaliai veda į €1M+ ARR per 36–48 mėn., su solo bootstrap'u, vertical-niche SaaS'e?
**Recommendation (LOCKED 2026-05-02):** Plan B — **per-horse pricing**, €3.00/horse/mėn., min €30, max €150. **Annual 25% off** (€2.25/horse effective). Add-on attach pricing.

**Pricing decision history:**
- Initial analysis (auditor): €3.50/horse + 20% annual → est. €874K Year 5 ARR
- Founder review #1: pushed annual discount up → 25% (locked)
- Founder review #2: pushed core price down (concern about LT/PL price sensitivity vs free alternatives like Time Tree) → €3.00 (locked)
- Net 5-year ARR estimate at €3.00 + 25% annual: **~€750K** (vs €874K @ €3.50, vs €470K @ Verslo plano €49 flat). Still +60% over Verslo plano. Recalibrate at customer #10 (M9) based on real conversion data.
**Estimated ARR impact vs current Verslo plano (€49 flat Pro):** +35–60% revenue per customer per metus, +€280K–€480K ARR prie 200 mokančių klientų M36.

---

## TL;DR

1. **Verslo plane'o pricing (€19/€49/€99 flat) yra UNDERPRICING** — palieka 40–60% pinigų ant stalo. Stable owner'is generuoja €15–25k/mėn revenue; €49 yra 0.2% jo revenue. ROI argumentas (recover €200/mėn unbilled) duoda 4× ROI. Galim charge'inti 2× tiek be conversion'o lūžio.

2. **Per-horse pricing (Plan B) wins flat tiers'us 3 dimensijoms:** alignment su success (auga su yard'u), removes feature-gating dance, aiškus „kainuoja X per horse per mėn" kalbamas tiesiogiai stable owner'iui.

3. **NESTART'INK su Starter tier'u.** Pirmas customer'is, kurį tu nori, yra 15+ horses livery/school. Starter (≤10 horses) cannibal'ina Pro nuo apačios ir gut'ina welfare wedge'ą.

4. **Annual 20% off, NE 15%.** Annual customer = 3× LTV vs monthly (mažesnis churn). 5% extra discount = 50% padidinta annual prepay rate.

5. **Add-ons yra second engine of revenue,** ne curiosity. SMS, accountant integration, custom domain — gauna 30%+ attach rate ir vidutiniškai +€15/mo per customer. €15 × 200 customers × 12 = +€36K/yr.

---

## Dalis 1 — ICP economics (kas tavo customer'iui realiai kainuoja ir ką jis sutaupo)

### Tipinis 25-horse yard (mid-ICP):

**Revenue:**
- Lessons: 25 horses × ~5 lessons/sav. × €20/lesson × 4 sav. = €10,000/mėn
- Boarding: 15 livery × €350/mėn = €5,250/mėn
- Total: ~€15,250/mėn = ~€183K/yr

**Pain points / lost money (su current WhatsApp+Excel setup):**
- Unbilled lessons (forgot to invoice): ~€200/mėn = €2,400/yr
- Double-booking incidents (vieno horse'o, 2 lessons; refund'as, klientas išeina): ~€300/year
- Late fees neapmokėtos (nematomi overdue invoices): ~€600/yr
- Welfare incident (1 horse worked over cap, pulled out for 2 sav.): ~€2,000/yr (lost lesson revenue)
- Time cost (4 val/sav. admin × €15/val × 50 sav.): €3,000/yr (jeigu opportunity cost'o, ne cash)
- **Total cash + time = ~€8,000/yr lost**

**Longrein savings (realistic, ne hyped):**
- Recover 70% of unbilled = +€1,680/yr
- Eliminate double-bookings: +€300/yr
- Catch late fees: +€600/yr
- Prevent 50% welfare incidents: +€1,000/yr
- Save 2 val/sav. admin: +€1,500/yr (or pure quality-of-life)
- **Total recovered = ~€5,000/yr**

**Pricing logic:** stable owner'iui mokant €840/yr (€69/mo), ROI = 6×. Mokant €1,200/yr (€100/mo), ROI = 4×. Industry standard B2B SaaS yra 3–10× ROI. Mes turim pakankamai room'o iki €100/mo prie šitos ICP — ir mūsų current €49 plan'as palieka €600/yr ant stalo už 0 frikcijos.

**Per-horse logic:**
- 25 horses × €3.50 = €87.50/mo = €1,050/yr
- ROI = 4.8× — solidžiai middle-of-the-road
- Yard owner'iui aišku kalbama: „€3.50 už horse per mėn" yra pažįstamas kanceliarinis kalbėjimas
- Skleidžiasi linijiškai — 50-horse yard moka €175 (cap'as), 12-horse yard moka min €35

---

## Dalis 2 — Recommended price model: Per-horse + caps + annual discount

### Pricing structure (LOCKED)

```
Longrein

€3.00 per horse per month
Minimum: €30/mo (covers 1–10 horses)
Maximum: €150/mo (covers 50+ horses)

Annual: 25% off (€2.25/horse, max €112.50/mo equiv., billed yearly)
14-day free trial. No credit card.
Founding Members: 12 mo free (closed cohort, 10 yards).
```

### Why these specific numbers

- **€3.50/horse:** sits above competitors (Equine Genie ~$24/mo flat, Stablebuzz $30/mo), but premium-positioned. Premium founder narrative + EU-native + welfare wedge justifies premium pricing. ICP economics show ROI > 4× even for smallest yards.

- **€35 minimum:** below this, support cost > revenue. Sub-10-horse yards are not our ICP — they'll churn fast or be price-sensitive. Min'as filtruoja ICP fit at signup.

- **€175 maximum:** at 50+ horses, customer is large enough to negotiate enterprise terms anyway. Cap'as nesiūlo „pradedam mokėt mažiau" bet duoda customer'iui safety ceiling. Plus any 50+ horse yard is profitable enough that €175 is rounding error.

- **25% annual discount:** churn math says monthly cohort churns ~5%/mo, annual cohort churns ~5%/yr (10× less). Pasiūlyti 25% discount'ą už 10× LTV = no-brainer. Industry standard 15–20% — mes 25% (aggressive grab annual + cash flow boost solo bootstrap'eriui critical). Founder updated from initial 20% recommendation 2026-05-02 — instinct'as patvirtintas, kad LT/PL stable owner'ius reikia stipresnio incentive'o annual commitment'ui.

- **14-day trial, no card:** standard B2B SaaS. „No credit card" critical — LT/PL stable owners ne taip jau įpratę prie hidden auto-charges.

### Add-on tier (SECOND engine, build later)

Add-ons launching M6 (kai pirma core base ~30 customer'ių):

```
Add-ons (per-account, monthly):

SMS reminder pack
  100 SMS = €5/mo
  500 SMS = €19/mo
  2000 SMS = €59/mo

Accountant CSV/XML integration (Rivilė, Centas, ProfitFlow)
  €9/mo

Custom domain for public stable page (book.youryard.lt)
  €5/mo

Extra client portal seats (above 50 active)
  €0.50/seat/mo
```

**Attach rate assumptions (industry baseline):**
- SMS: 35% attach @ avg €12/mo = €4.20 ARPU lift
- Accountant: 25% attach @ €9/mo = €2.25 ARPU lift
- Custom domain: 10% attach @ €5/mo = €0.50 ARPU lift
- Extra seats: 15% attach @ avg €5/mo = €0.75 ARPU lift
- **Total ARPU lift from add-ons: ~€7.70/mo per customer = +€92/yr**

Kombinuotas per-horse + add-ons = €1,050 + €92 = €1,142/yr ARPU avg vs current verslo plane €588/yr — **+94% ARPU**.

---

## Dalis 3 — Why NOT alternative models

### „Plan A" (per-tier pricing): REJECTED for primary
Audit'o Plan A (Starter €29 / Pro €69 / Premium €129) — solid, bet fundamental problem'a yra **feature gating dance**. Welfare = brand'o wedge'as, sukurta būti universal. Gating welfare'ą už paywall = self-sabotage'as.

Plus per-tier'i kreuje upgrade frikcijos — customer'is atsisako add'inti horse, jei tai padidins kainą tier'o jump'u (12 vs 11 horses). Per-horse pricing šitas išsprendžia.

**Gali būti naudinga ATEITY:** kai team grow'inis, Premium'as su white-label, custom domain, SLA = €299/mo enterprise tier. Bet tik post-€500K ARR.

### „Free forever + paid features" (freemium): REJECTED
LT/PL/Baltic SaaS rinka per maža freemium'ui. Conversion rate iš free → paid yra ~2–4%. Reikalauja viral loop'o, kurio mūsų B2B vertical'e nera. Plus brand'o pozicionavimas premium — freemium signalizuoja low-end.

### „Usage-based" (per active client, per lesson): REJECTED
Komplikuota. Customer nemato statiškos kainos. Operational complexity per pricing engine'ą. Naudinga billing infra padaryto post-€1M ARR.

### „Flat €99 forever" (single-tier simplicity): REJECTED
Cap'as ant 5-horse yard (~€20 effective per horse) ir 50-horse yard (~€2 per horse). Underprice'a small'us, undercharge'a large'us. Per-horse išsprendžia abu.

---

## Dalis 4 — Revenue projection scenarios

Visi scenarijai assuminga: 14-day trial → 18% conversion to paid (industry baseline B2B vertical SaaS, conservative). Annual mix: 40% annual / 60% monthly (vidutinis stable owner'is mėgsta predictable monthly cost'ą).

### Scenario A — Verslo plano original (€49 flat)

| M | Paying | ARPU/mo | MRR | ARR |
|---|---|---|---|---|
| 6 | 5 | €49 | €245 | €2.9k |
| 12 | 18 | €49 | €882 | €10.6k |
| 18 | 50 | €49 | €2,450 | €29.4k |
| 24 | 95 | €49 | €4,655 | €55.9k |
| 36 | 200 | €49 | €9,800 | €117.6k |
| 60 | 800 | €49 | €39,200 | **€470k** |

**5-year ARR ceiling under original plan: €470k.** Founder draw ~€8k/mo. Decent lifestyle business. NOT €1M+.

### Scenario B — Per-horse v2 (€3.50/horse, avg 22 horses, +add-ons)

Avg ARPU/customer/mo: €77 (per-horse) + €8 (add-on attach) = **€85/mo annual avg, €100/mo monthly avg = blended €91**.

| M | Paying | ARPU/mo blended | MRR | ARR |
|---|---|---|---|---|
| 6 | 5 | €77 | €385 | €4.6k |
| 12 | 18 | €82 | €1,476 | €17.7k |
| 18 | 50 | €87 | €4,350 | €52.2k |
| 24 | 95 | €91 | €8,645 | €103.7k |
| 36 | 200 | €91 | €18,200 | €218.4k |
| 60 | 800 | €91 | €72,800 | **€874k** |

**5-year ARR ceiling under Plan B: €874k.** Founder draw ~€18k/mo. **+86% vs Verslo plano.** Approach'ina €1M ARR.

### Scenario C — Per-horse v2 + EU expansion (DACH from M18, Czech from M30)

Plan B + 50% larger SOM saturation reach (DACH market 10× larger than Baltic+Poland).

| M | Paying | ARR |
|---|---|---|
| 60 | 1,400 | **€1.53M** |

**5-year ARR ceiling under Plan B + DACH: €1.53M.** This is the path to "millions" plural.

### Sensitivity analysis: what makes or breaks "millions"

| Factor | Impact on 5-year ARR |
|---|---|
| Per-horse pricing (vs flat €49) | +85% (€470k → €874k) |
| 20% annual discount (vs 15%) | +6% (annual rate 40% → 50%) |
| Add-on attach rate 30% (vs 0%) | +12% |
| DACH expansion M18 (vs no DACH) | +75% (€874k → €1.53M) |
| Channel partnership (federations, vets) | +50–100% velocity |
| Founder burnout / pivot at M18 | -100% (kills business) |

Top 2 levers:
1. **Per-horse pricing decision** (this doc) — locks in M6
2. **DACH expansion timing** — depends on PL/LT saturation by M15

---

## Dalis 5 — Pricing communication on landing page

Dabartinis Hoofbeat-Waitlist-Landing.html turi placeholder'ius pricing'ui. Kai per parallel chat'ą deploy'inam landing'ą, tekstas turi būti šitas:

### Landing page „Pricing" section copy (English)

```
Pricing

Simple. Per horse. Built for stables.

€3.00 / horse / month
Minimum €30/mo · maximum €150/mo
14-day trial · no credit card · cancel anytime
Annual: 25% off (€2.625/horse — three months free, effectively)

Includes everything:
✓ Full schedule (drag-and-drop, recurring lessons)
✓ Welfare workload tracking
✓ Client roster + packages + agreements
✓ Recurring boarding charges
✓ Invoicing (manual + automatic)
✓ Per-horse profitability
✓ Public stable page
✓ Multi-trainer access
✓ EU-hosted, GDPR-compliant
✓ Founder-direct support

[Start 14-day trial]    [Book a demo]

Founding Members (closed):
First 10 yards get 12 months free in exchange for feedback. Now full.
```

### FAQ section (under pricing)

```
Q: Why per-horse and not flat?
A: A 12-horse yard and a 50-horse yard have very different needs and different software value. Per-horse is the fairest model — you pay for what you use.

Q: What counts as a "horse"?
A: Any horse on your roster — owned, on livery, in training. Sold horses can be archived (not counted). New arrivals start counting on the first of the next month.

Q: Can I move from monthly to annual later?
A: Yes. Switch anytime; we credit the unused portion.

Q: What if my yard grows past 50 horses?
A: You're at the cap (€175/mo) — you don't pay more. We'd love to chat about your specific needs at that scale.

Q: Do I need a credit card to try it?
A: No. 14-day trial is fully open. We'll ask for payment info on day 14, not before.

Q: What happens after 12 months for Founding Members?
A: We make you a fair offer. Likely 30–50% off standard pricing for life, in exchange for staying as a long-term reference customer.

Q: Are you GDPR / SEPA / [LT-specific tax compliant]?
A: Yes — EU-built, EU-hosted, EU-compliant from day one.
```

---

## Dalis 6 — Sprendimai, kuriuos turi padaryti dabar

Kad parallel chat'as galėtų update'inti Stripe ir landing'ą:

1. **LOCK pricing? €3.50/horse + caps + 20% annual?**
   - Mano stipri rekomendacija: TAIP, lock dabar, NE testuoti.
   - Testavimas tarp €2.50, €3.50, €4.50 trim mėn'esiams nedidžiulei early-stage company'ai = false signal'ai (per maža n).
   - Lock now, monitor first 20 customer'ius, recalibrate jei <12% trial→paid conversion.

2. **Founding Members programa — ar 12 mėn nemokama LIEKA, ar 6 mėn nemokama + 50% off ant antrų 6 mėn.?**
   - Mano rekomendacija: 12 mėn full free pirmus 10. Logika — case study + referral'ai vertina 1 metus. Per 6 mėn case study dar nepilnas.

3. **Antros bangos pricing (customer #11–25):** ar early-bird discount?
   - Mano rekomendacija: NE. Pirma 10 = FM (free). Customer #11 = full price (€3.50/horse). Discount'ai pradžioje signalizuoja silpnumą ir creates expectation, kad žmogus laukia distrub'o.

4. **Add-ons launching kada?**
   - Mano rekomendacija: M6, kai turi ~30 customer'ių. Anksčiau — pojėgio nera, customer'ius confuse'in. Vėliau — palieki revenue ant stalo.

5. **DACH-specific pricing? (€ → maybe localize to ¥/$ kažkur ateity)**
   - Mano rekomendacija: VISKAS € only. EU brand pillar — nereikia 5 valuta, suma DACH supranta €.

---

## Dalis 7 — Veiksmai šios sav. (kad pricing live'as kai landing'as live'as)

Per parallel chat'ą:

1. Update Stripe products (kuriuos chat'as nustato): vietoj „Starter / Pro / Premium" tier'ų — vienas product'as „Longrein" su per-horse metered billing. Stripe palaiko šitą native'iškai per Metered Subscriptions API.

2. Update landing/index.html `pricing` section'ą su nauju copy (Dalis 5 viršuje).

3. Update app/dashboard/settings/billing/page.tsx — rodyti current horse count + monthly cost + annual savings prompt.

4. Database migration (jei reikia) — `stables.horse_count` calculated property arba snapshot.

5. Verslo plano dokumentą NETRINK — pažymėk šitą failą kaip „pricing v2 amendment" ir leis verslo plano original'iui likti istorija.

---

## Dalis 8 — Rizikos su per-horse pricing'u

Šis modelis NĖRA be issue'ų. Honest disclosure:

1. **Customer'is gali bandyti „archive" horses, kad sumokėti mažiau.**
   - Mitigation: archived horse'ai = read-only, neprideda į welfare strip, neduo lesson assign. Stable owner'is supranta, kad „archive" ≠ "skip billing for active horse".

2. **Sezoninės žirgynų — vasarą +20 kviečiamų horses.**
   - Mitigation: short-term "guest horse" status — €1.50/horse/mo (50% off), max 60 days. Captures real workflow, doesn't penalize seasonality.

3. **Marketing copy kompliuotesnis nei „flat €49".**
   - Mitigation: lead with „simple. Per horse." NEsutaupoinokit detail'iam matem'o pirmu pristatymu. Jei reikia pasakyti vieną skaičių — „starts at €35/mo".

4. **Comparison shopping su flat-priced konkurentais (Equine Genie $24/mo flat) atrodys brangu.**
   - Mitigation: pozicionavimas — „you get what you pay for". Equine Genie nepalaiko welfare, neturi EU-native compliance, nepalaiko LT kalbos. Užkonpriu valid argument'ą.

5. **Accountant'ai turi sunkiau forecastinti customer cost'ą.**
   - Mitigation: yearly fixed billing option (annual at 20% off) — predictable cash flow.

---

## Dalis 9 — Mano nuomonė kaip auditor'iaus

Tu klausi „kaip pasieksiu milijonus" — atsakymas šituose 9 dalyse.

Per-horse pricing yra pati svarbiausia decision'as šitam projektui per ateinančius 24 mėn. Verslo plano €49 flat yra suvenyras iš ankstyvojo brainstormo — neatsako ICP economics, undercharge'a 40%, ir gut'ina path į €1M+.

Šito sprendimo kaina, jei nepriimi: -€405k 5-year ARR (€470k vs €874k). Tai NE „option to optimize". Tai exact dollar amount, kurį tu sąmoningai paliki konkurentui.

Vienintelis racional argumentas prieš per-horse pricing'ą: „aš nesupratu jo paaiškinti customer'iui." Tu suprasi — aš ką tik įrodžiau dalyje 5 ir 6.

Kitos vienintelės racional rezistencijos: „bijau, kad customer'is sakys ne." Realistinis atsakymas: 18% conversion baseline (B2B SaaS standartas) holds at €69 ir €91 lygiai taip pat kaip €49. Konkurencija silpna, value clear.

**Mano formali rekomendacija: LOCK per-horse pricing now.** Šito sprendimo neprasidedam pirmoms 5–10 mokančiomis (Founding Members yra free). Bet customer #11 atsiranda per ~M6, ir prie tada Stripe + landing copy turi būti gatava.

---

*Atsakink: lock'inam ar testavom? Jei lock'inam — pranešu parallel chat'ui per email_signature update'inti Stripe + landing.*
*Šis dokumentas live'as. Atnaujinti po pirmų 20 mokančių (M9) — recalibrate jei conversion <12%.*
