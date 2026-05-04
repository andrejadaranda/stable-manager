# Longrein — Year-1 Financial Strategy

**Companion document to `Longrein-Year1-Financial-Model.xlsx` (5 sheets, in same folder).**
**Šis dokumentas:** strateginė interpretacija — ką žiūrėti modeliui, kada veikti, kokie decision triggers'ai.
**Naudojimas:** atidaryti modeliui kiekvieno mėnesio pirmą pirmadienį. Užpildai „Monthly Review Template" sheet'ą real'iais duomenimis. Lygin'i prieš LIKELY case. Veiki pagal triggers'us.

---

## TL;DR — kas modelyje yra ir ką jis tau pasako

Modelis turi 5 sheet'us, ranged pagal naudojimo tankį:

1. **Revenue M0-M12** — base case projection'as. M12 cumulative: 35 paying customers, €3,045 MRR, €36,540 ARR run rate. Tai LIKELY scenario.
2. **Expenses M0-M12** — kiekviena išlaidų kategorija per mėn. Year-1 total ~€10,500 (incl. €4,000 founder draw from M9+).
3. **Cash Flow & Runway** — net cash position per mėn. Su €5,000 starting reserve, baigi M12 su ~€5,400 surplus (tight but positive).
4. **Sensitivity Scenarios** — best/likely/worst su decision triggers'ais. Šitas svarbiausias sheet'as strategiškai.
5. **Monthly Review Template** — užpildai 1× per mėn., konkrečių klausimų checklist.

**Pagrindinis takeaway:** šis kelias yra **TIGHT**. €5,400 cash surplus M12 yra ~1.5 mėn. expenses buffer. Vienas blogas mėn. (-€2K vs forecast) ir esi neigiamas. Bet tai NORMA bootstrap'eriui — discipline ne distres'as.

---

## Dalis 1 — Modelio key assumptions (kritiškai svarbu suprasti)

Kiekviena cifra modelyje stovi ant prielaidų. Jei prielaidos klaidingos, modelis klaidingas. Štai kas YPATINGAI nesusijungs realybėje:

### A) Customer growth velocity

**Modelyje:** 0 paying M0-M5, 2 added M6, ramping to 8 added M12. Cumulative: 35 paying.

**Realiai:** customer #11 (pirmas mokantis) gali ateiti M5 (greitai) arba M9 (lėčiau). Founding Members konvertuoja M12 — bet jei FM neteisingai onboard'inami, jie taipogi gali nekonvertuoti. Realistiškas range: 18–50 paying M12.

**Decision trigger:** jei M9 paying customers <10 → re-evaluate FM onboarding + outreach quality.

### B) ARPU progression

**Modelyje:** ARPU starts at €75/mo (25-horse yard avg) ir grows to €87 by M12 (mix shifts toward larger yards + add-ons attach).

**Realiai:** pirmi customer'iai gali būti smaller yards (€30 minimum). ARPU gali būti tik €60 iki M12 jei larger yards delay'ina.

**Decision trigger:** jei ARPU <€70 per M9 → focus outreach į larger yards (25+ horses).

### C) Churn rate

**Modelyje:** 3% per mėn. (industry baseline 5%; modeli'is optimistic dėl vertical specialization).

**Realiai:** Founding Members nelies churn'inami (free). Pirmi mokantys customer'iai (M6+) — TRUE churn data ateis M9-M12. Vertical SaaS dažnai turi LOWER churn nei horizontal (sticky workflow).

**Decision trigger:** jei churn >5%/mo per M9-M12 → customer interview round'as. Identifikuoti top 3 churn priežastis.

### D) Expense discipline

**Modelyje:** ~€500-€1,200/mo expenses. Founder draw €500/mo from M9.

**Realiai:** „buferis 10%" line yra svarbiausia — netikėtos išlaidos PRIVALOMOS bootstrap'erio modelyje. Realios išlaidos tipiškai 15-25% virš forecasted.

**Decision trigger:** jei mėnesinė variance >20% over forecast 2 mėn. iš eilės → audit išlaidų, cancel non-critical SaaS.

### E) Cash starting reserve

**Modelyje:** €5,000 starting reserve. Tai assume'a, kad tu turi šitą reserve'ą Day 0.

**Realiai:** Patikrink. Jei mažiau — buferis sulieka, kiekvienas blogas mėnuo gilesnis pavojuje.

**Decision trigger:** jei starting reserve <€3,000 → friends/family seed round (€10K-€20K) PRIEŠ launch'ą, NE po.

---

## Dalis 2 — 5 critical decision gates per Year 1

Šie yra pre-defined moments, kada tu LITERALIAI sėdi su modeliu, žiūrai duomenis vs forecast, sprendi.

### Gate 1: M3 (Rugpjūtis 2026) — FM outreach effectiveness

**Klausimas:** Ar Founding Members outreach generuoja rimtus demos?

**Žiūri:**
- Active demos this month (target: 8-12)
- Demo → trial conversion (target: 60%)
- Founding Members slots filled (target: 5/10)

**Sprendimai:**
- ✅ Hit'inta: continue plan, prepare M6 public launch
- ⚠️ Vidutinė miss (60-80% of target): adjust outreach copy, narrow ICP
- 🔴 Total miss (<40%): STOP outreach. Customer interviews to understand why FM message isn't landing. Could be brand voice, could be ICP mismatch, could be timing.

### Gate 2: M6 (Lapkritis 2026) — public launch validation

**Klausimas:** Ar pricing v2 (€3.00/horse) konvertuoja real'iai?

**Žiūri:**
- New paying customers M6 (target: 2)
- Trial-to-paid conversion (target: 18%)
- ARPU avg (target: €75)

**Sprendimai:**
- ✅ Hit'inta: pricing v2 validated, continue
- ⚠️ Vidutinė miss (10-15% conversion): ANALYZE — is it pricing OR onboarding OR product gap?
- 🔴 Total miss (<8% conversion): possible price drop trial. Test €2.50/horse with next 5 customers (recall pricing strategy doc — customer #10 recalibration trigger).

### Gate 3: M9 (Vasaris 2027) — runway + founder draw activation

**Klausimas:** Ar gali pradėti imti founder draw (€500/mo)?

**Žiūri:**
- MRR (target: €500+)
- Cash position (target: still positive)
- 3-month forward cash projection

**Sprendimai:**
- ✅ MRR ≥€500 + cash positive: ACTIVATE founder draw €500/mo
- ⚠️ MRR €300-€500: postpone draw to M11. Continue founder personal subsidization.
- 🔴 MRR <€300: serious problem. Either accelerate sales effort 2x OR consider raising friends/family round.

### Gate 4: M12 (Gegužė 2027) — DACH hire decision

**Klausimas:** Ar gali hire'inti pirmą DE-native team narė per DACH playbook'ą?

**Žiūri:**
- M12 cash position (target: ≥€10K)
- M12 paying customers (target: ≥35)
- M12 churn rate (target: <5%)
- 6-month forward cash projection (must support €30K-€55K hire over 12 mo)

**Sprendimai:**
- ✅ All targets hit: hire DE Customer Success Lead (60-80% part-time, €30-€45K/yr)
- ⚠️ 2-3 targets miss: postpone hire to M18. Continue solo DACH preparation.
- 🔴 4 targets miss: DACH plan FROZEN. Refocus exclusively on Baltic+Polish saturation. Re-evaluate at M18.

### Gate 5: M12 review — Year 2 strategy lock

**Klausimas:** Kuriam keliu tęsi į Year 2?

**Žiūri:** Total Year-1 ARR achieved + cash position + customer retention

**3 keliai (per scenarios sheet):**

**Path A (BEST case hit):** ≥€57K ARR, €12.5K cash, 50+ customers
→ Aggressive Year 2: DACH launch M18, hire 2nd team narė M22, target 100+ customers M24

**Path B (LIKELY case hit):** ~€36K ARR, €5K cash, 35 customers
→ Steady Year 2: DACH soft launch M18 (1 hire 60% time), continue Baltic+Polish saturation, target 65 customers M24

**Path C (WORST case):** ~€16K ARR, negative cash, 18 customers
→ Pivot Year 2: NO DACH push, focus exclusively on existing customer success + product fixes, raise €15-€25K friends/family seed, target 30 customers M24

---

## Dalis 3 — LT bookkeeping + tax setup recommendations

### Business structure decision (M0)

Tu pre-revenue. Du keliai:

**A) Individuali veikla (sole proprietorship)** — recommended pradžioje
- Lower compliance overhead
- Personal tax rate (5-15% effective)
- VAT registration triggered at €45K/yr revenue (LT threshold)
- NO setup cost, just register at VMI online (~30 min)
- **Trigger to upgrade to UAB:** when revenue >€50K/yr OR taking outside investment OR planning to hire

**B) UAB (limited liability company)** — defer to M12-M18
- Higher compliance (annual financial statements, board structure, etc.)
- 15% corporate tax (or 0% for first 2 years if revenue <€300K — small business incentive)
- More credible for partner negotiations (LSF, vet clinics)
- Setup cost ~€500-€1,500
- Required if hiring employees

**My recommendation:** Start as individuali veikla. Convert to UAB at M12 IF: ≥€20K MRR ACHIEVED + planning DACH hire + need to scale legal/billing complexity.

### LT accountant search (M5)

Hire monthly accountant from M6 (when first paying customer comes online). Šitas yra €60/mo line in expense model.

**Selection criteria:**
- Specializuojasi small business / SaaS clients (ne just industrial accounting)
- Komfortabilus dirbant Rivilė ar Centas (LT standard tools)
- Kalba EN OR has English-speaking partner (svarbu jei tu kada nors raise'inisi su international investors)
- Atsako per 24-48 val email'ams
- Fixed monthly fee (NOT per-transaction billing)

**Where to find:** Notion (LT version), recommendations from other LT bootstrap'erių, search „SaaS apskaitininkas Lietuva" LinkedIn.

**Initial conversation:** monthly P&L, quarterly VAT (kai bus), end-of-year tax filing. ~€60-€100/mo for a clean small SaaS.

### VAT registration timing

**Mandatory at:** €45,000/yr taxable turnover (LT threshold per 2025+).

**When this hits in our model:** M22-M24 (under LIKELY scenario).

**Pro-active VAT registration:** kai turi >€10K MRR, register voluntarily even before threshold. Reasons:
- Allow customers to claim VAT input deduction (B2B-friendly)
- Cleaner accounting from day one
- Easier for DACH expansion (DE VAT is mandatory differently)

### Bank account

**Open LT business bank account** (NOT use personal account).

**Recommended LT options:**
- Swedbank Business — most common, full feature set, ~€10-15/mo fees
- SEB Business — similar to Swedbank
- Revolut Business — modern UI, multi-currency, lower fees, fully online
- Mano Bank — pure-online, cheapest

**My recommendation:** Revolut Business. Multi-currency essential for DACH expansion. Modern API for accounting integrations. €0/mo for basic tier.

### Quarterly tax obligations

LT individuali veikla:
- Quarterly income tax declaration (15% on profits)
- Quarterly VAT declaration (when registered)
- Annual income tax filing (by May 1 of following year)

Your accountant handles these. You provide raw data via Longrein financial reports + bank statements + receipts.

---

## Dalis 4 — Monthly review discipline (HOWTO)

Šitas yra ne optional. Founder'iai, kurie peržiūri financials kas mėn., 3x labiau success'ina nei tie, kurie peržiūri kas ketvirtį.

### Setup (one-time, ~30 min)

1. Set recurring kalendoriaus event'ą — „Longrein Monthly Review" — pirmas pirmadienis kiekvieną mėn., 90 minučių, 09:00
2. Bookmark `Longrein-Year1-Financial-Model.xlsx` (Drive 05_Finance folder'yje)
3. Print empty „Monthly Review Template" sheet — užpildysi ranka pirmą kartą, kad įsisąmonintum

### Monthly review flow (90 min, kiekvieną pirmadienį)

**Min 0–15: Cash position check**
- Atidaryk Revolut Business + LT bank
- Transcribe į Monthly Review sheet (Cash position section)
- Compare vs prior mo: are we accumulating or burning?

**Min 15-30: Revenue review**
- Open Stripe (when active) + Longrein internal dashboard
- Note: MRR, new paying, total paying, ARPU
- Compare vs LIKELY case forecast (Revenue sheet)
- Variance noting — better, on track, behind?

**Min 30-45: Churn analysis**
- Anyone churned this month? List names + reasons (asked them directly?)
- Anyone showing yellow flags (low usage, unanswered emails)?
- NRR calculation: (start MRR + expansion - churn) / start MRR

**Min 45-60: Expenses audit**
- Open all SaaS subscriptions list, vendor invoices
- Did anything go above forecast? Why?
- Anything to cancel (unused subscriptions)?
- Total monthly expenses vs forecast

**Min 60-75: Pipeline assessment**
- Active demos this month
- Trial conversions
- Founding Members slots remaining
- Pipeline value (potential MRR if all close)

**Min 75-90: Decisions + next month commitments**
- 3 decisions needed this month (write them down explicitly)
- Red/yellow/green flags
- 3 lessons learned
- Top 3 priorities next month

**End of session:** save Monthly Review filled-in version. Email to yourself for record.

### Quarterly deep-dive (every 3rd month, ~3 hours)

End of Q1, Q2, Q3, Q4: deeper analysis beyond monthly.

- Trend analysis (3-month moving averages)
- Cohort analysis (customer retention by signup month)
- Pricing recalibration check (per Pricing Strategy doc — customer #10 recalibration)
- Strategic decision review (DACH go/no-go, hire timing, expansion timing)

---

## Dalis 5 — Common founder financial mistakes (NEdaryti)

Iš observed pattern'ų šimtuose bootstrap SaaS company'ų:

1. **„I'll do bookkeeping later"** — by M6 it's a mess. Hire accountant M5 latest.
2. **„Cash flow doesn't matter, MRR is king"** — MRR is signal of success, cash is reality of survival. Watch BOTH.
3. **„I'll take a founder draw eventually"** — without scheduled draw, founders deplete personal savings AND avoid recognizing the business is unsustainable. Activate €500/mo draw at M9 even if it feels „too small."
4. **„My accountant will figure out taxes"** — accountants do filings, NOT strategy. You decide VAT timing, business structure, expense classification.
5. **„I'll forecast more aggressively next year"** — every founder over-forecasts year 2. Run BOTH likely AND worst case scenarios. Plan for likely, prepare for worst.
6. **„Cancel SaaS to save money"** — false economy. Cancel only TRULY unused tools. Cutting Plausible to save €9/mo while losing visibility into customer behavior is not savings.
7. **„Customer churn is rare"** — until it's not. Track NRR (Net Revenue Retention) from M6, not from M18.

---

## Dalis 6 — When to raise vs continue bootstrap

Bootstrap'as is valid path. Raising is also valid. NEITHER is morally superior — they suit different goals.

### When bootstrap stays right path:
- M12 ARR ≥€20K AND positive cash flow
- Customer growth on pace (LIKELY scenario or better)
- Founder personal sustainability (not burning out)
- DACH expansion can wait until M18+ comfortably

### When raise becomes worth considering:
- M12 ARR <€10K AND negative cash position (forced raise — distress fundraise = bad terms)
- M12 ARR ≥€30K AND clear path to €100K (opportunity raise — accelerate good thing)
- DACH wants entry M14 (early) but cash doesn't support DE hire
- Competitor moves aggressively into Baltic+Polish (defensive raise)

### Raise mechanics if needed:

**Tier 1: Friends/family seed (€10K-€25K)**
- 12-month convertible note, 5% interest, 20% discount on next round
- Use only if cash position requires
- LT/PL/EE has small angel community (LT Tech Forum, EstBAN)

**Tier 2: Pre-seed (€100K-€300K)**
- Vertical SaaS in non-US niche is unfashionable in EU pre-seed funds — most will pass
- BUT — Baltics/CEE specialty funds (Practica Capital, Open Circle, Tera Ventures) might engage
- Trade-off: 15-20% equity for 18-24 mo runway + DACH push

**Tier 3: Seed (€500K+)**
- Premature for our scale. Would dilute heavily. Only consider if 3+ years AHEAD of pace.

**My recommendation:** stay bootstrap through Year 1. If LIKELY case hits, evaluate fundraise at M14-M18 for DACH acceleration. If WORST case, evaluate fundraise (small) at M9-M12 to avoid death spiral.

---

## Dalis 7 — Year-1 success criteria

End of Year 1 (May 2027), you want to be able to truthfully say:

✅ **Revenue:** ≥€20K ARR (LIKELY case = €36K, hopeful)
✅ **Customers:** ≥30 paying customers (LIKELY = 35)
✅ **Cash position:** Positive (LIKELY = €5K surplus)
✅ **Churn:** <5%/mo
✅ **NPS:** >40 (asked formally to all customers M9 + M12)
✅ **Founder sustainability:** working ≤50 hrs/wk on average, taking €500+/mo draw
✅ **Founding Members:** 8/10 still active and willing to renew at standard pricing
✅ **Founder energy:** still excited about Longrein after 12 mo (NOT burned out)

If 6+ of 8 met → continue Year 2 with confidence.
If 4-5 met → continue but slow expansion, focus existing customer success.
If <4 met → serious pivot conversation. Consider raising, scope reduction, or partner.

---

*Šis dokumentas live'as. Atnaujinti po kiekvieno quarterly deep-dive. Įkelti į Drive `05_Finance/`.*
