# Longrein — Lithuania Business Registration & Legal Setup

**Klausimas:** Kokia teisinė struktūra tinkamiausia Longrein'ui Year-1, ir kaip ji evolves su revenue?
**Recommendation (LIKELY case):** **Individuali veikla M0–M12** → konvertuoti į **UAB M12-M18**, kai MRR ≥€2K + planning DACH hire + nori liability protection.
**Critical disclaimer:** šis dokumentas YRA strateginis overview. NE legal counsel. LT licencijuotas teisininkas + accountant'as turi finalizuoti šitus sprendimus. Mano darbas: kad tu žinotum WHAT to ask juos, NE WHAT to do.

---

## TL;DR

Du keliai LT founder'iui solo SaaS'ui:

| Aspect | Individuali veikla | UAB |
|---|---|---|
| Setup time | 30 min online | 2-4 weeks |
| Setup cost | €0 (online registration) | €500-€1,500 (notary + state fees) |
| Annual compliance | Quarterly tax declaration | Annual financial statements + audits >€700K |
| Personal tax rate | 5-15% (depends on revenue tier) | 15% corporate tax (0% first 2 years if revenue <€300K!) |
| Personal liability | UNLIMITED — your personal assets at risk | LIMITED to UAB capital (typically €1,000-€2,500 minimum) |
| Investor-readiness | Cannot easily take outside investment | Standard structure for VC/angel investment |
| VAT registration | At €45K turnover threshold | Same threshold |
| Hiring employees | Possible but complex | Standard |
| Brand perception | "Solo freelancer" feel | "Real company" feel |

**Mano recommendation:** Start as individuali veikla DABAR. Convert to UAB when:
1. MRR ≥€2,000 (proven sustainable revenue), OR
2. Need to hire first employee (DACH hire M14), OR
3. Risk profile requires limited liability (B2B contracts with €10K+ value)

Whichever comes first.

---

## Dalis 1 — Individuali veikla deep dive

### Kas yra individuali veikla?

Lithuanian sole proprietorship — simplest form of registered business. You ARE the business. No separate legal entity. Personal income tax with business expense deductions.

### Setup process (30 min, today)

1. Login VMI portal'ą: https://www.vmi.lt
2. „Mano VMI" → „Individuali veikla"
3. Fill in business activity codes (KEAP):
   - **62.01.0** — Computer programming activities (KAUNAS-friendly for SaaS)
   - **62.02.0** — Computer consultancy
   - **63.11.10** — Data processing, hosting (also relevant)
   - Pick 1-2 primary, can add more later
4. Set start date: today (or future date if you want)
5. Submit. Done.

VMI generates registration certificate within 24 val. Tu turi „individualios veiklos pažymėjimą."

### Tax obligations

LT individuali veikla taxation (per 2025+ rules):

**Personal Income Tax (GPM) on profits:**
- Up to €20,000/yr: **5%**
- €20,000-€35,000/yr: **15%**
- Above €35,000/yr: **15%** + sliding scale considerations

**Profits = Revenue − allowable business expenses**

**Allowable expenses (very broad in LT):**
- All Longrein vendor costs (Vercel, Supabase, Resend, Stripe fees, etc.)
- Marketing (photographer, dizainer, ad spend)
- Legal/accountant fees
- Domain registrations
- Equipment (laptop, phone partial — business use %)
- Travel for business (FM demo trips, conferences)
- Software subscriptions
- Professional development (courses, books)

**Practically:** if you generate €30K revenue and have €15K expenses, profit = €15K, tax = €750 (5%). VERY founder-friendly.

**Social Security (Sodra) contributions:**
- Mandatory if you have NO other employment
- ~12.52% of profit (PSDF) + 6.98% (PSDP) = ~19.5% of profit total
- Plus Health Insurance (PSDP) ~6.98%
- **Effective combined tax burden:** ~25-35% of profit (combining GPM + Sodra)

This sounds high but is competitive for EU. DE founders pay similar ~30-40% effective burden.

**Annual filing:** by May 1 of following year (annual income declaration via VMI).
**Quarterly:** advance tax payments based on prior year (or first year — none required).

### Monthly cash flow with individuali veikla

Example for our LIKELY M12 case:
- Revenue M12: €3,045 MRR = €36,540 ARR run rate
- Expenses M12 cumulative: ~€10,500 (per financial model)
- Year-1 profit (rough): ~€10K (revenue starts M6, ramps up)
- Year-1 tax: ~€500 (5% bracket — under €20K profit)
- Year-1 Sodra: ~€2,000 (~20% of profit)
- **Net to founder Year-1: ~€7,500**

Practically very manageable.

### Business bank account

Even as individuali veikla, you SHOULD have separate business account. NOT required by law, but:
- Cleaner accounting (your accountant will love you)
- Clear separation for tax audit defense
- Investor-readiness (clean financial trail when you eventually raise)

Recommended: **Revolut Business** (€0/mo basic tier, multi-currency, modern API for accounting integrations).

---

## Dalis 2 — UAB deep dive

### Kas yra UAB?

Uždaroji akcinė bendrovė — closed joint-stock company, similar to UK Ltd / DE GmbH / US LLC. Separate legal entity. Limited liability.

### Why upgrade from individuali veikla to UAB?

3 main reasons trigger the upgrade:

**1. Liability protection**

Risk: a customer sues you (e.g., data breach claim, contract dispute). With individuali veikla, your house, car, savings ARE the business assets. Plaintiff can claim against personal property.

With UAB: only UAB capital (€1,000-€2,500) is at risk. Personal assets protected.

**Trigger:** when first €10K+ B2B contract signed, OR first DPA (Data Processing Agreement) signed, OR enterprise-tier customer onboarded.

**2. Hiring employees**

Individuali veikla CAN hire (via Sodra registration), but UAB is standard structure.

**Trigger:** when hiring first employee (DACH Customer Success Lead M14 per DACH playbook).

**3. Investment-readiness**

VC/angel investors won't invest in individuali veikla — there's no equity to take. They want shares of a company.

**Trigger:** when planning to raise Friends/Family seed (€10K+) OR pre-seed (€100K+).

### Setup process (2-4 weeks, ~€500-€1,500)

1. Choose company name (Longrein UAB)
2. Define statutes (įstatai) — shareholders, share structure, management
3. Notary verification (Notaras) — €100-€300
4. State Registry (Registrų Centras) registration — €60
5. Open corporate bank account
6. Initial capital deposit (minimum €1,000, recommended €2,500+)
7. VAT registration (if applicable)
8. Sodra registration (employer)

**Use a corporate lawyer** for first UAB setup. ~€400-€1,000 fee. Saves you 20+ hours of confused VMI portal navigation.

### Tax obligations as UAB

LT corporate taxation:

**Corporate Income Tax (Pelno mokestis):**
- **0% first 2 years** if annual revenue <€300,000 (small business incentive — HUGE for early SaaS)
- **15%** standard rate after Year 2 OR if revenue exceeds €300K
- Reduced **5%** rate for small companies (employees ≤10, revenue <€300K)

**Founder takes money out via:**
- **Salary:** subject to ~30-40% combined tax burden (GPM + Sodra)
- **Dividends:** 15% withholding tax (you've already paid corporate tax — partial double taxation)

**Practical strategy:**
- Year 1-2 (UAB exempt 0% corporate tax): take minimal salary, retain earnings
- Year 3+: pay yourself salary at sustainable level + occasional dividends

### When UAB is wrong choice

DO NOT convert to UAB if:
- Revenue <€20K/yr (compliance overhead exceeds tax benefit)
- No employees and no plans to hire
- No outside investment intent
- Comfortable with personal liability exposure

UAB requires:
- Annual financial statements (~€300-€800 accountant fee)
- Annual report filing
- Board minutes (single shareholder = simplified)
- More complex bookkeeping

For Year 1, individuali veikla saves you ~€2,000 in compliance overhead.

---

## Dalis 3 — VAT registration strategy

### LT VAT thresholds

**Mandatory VAT registration** when EITHER:
- Revenue >€45,000 in any 12-month period (LT threshold per 2025+)
- OR you sell B2B to other EU countries >€10,000/yr (EU VAT OSS rules)

**Voluntary VAT registration** allowed any time (even pre-revenue).

### Should you voluntarily register before threshold?

**Pros of voluntary registration:**
- Customers (B2B) can claim VAT input deduction → they prefer suppliers with VAT
- Cleaner accounting from Day 1 (no migration headache later)
- Can claim VAT back on YOUR business expenses (Vercel, Supabase, etc. — many already charge VAT)
- Required for DACH expansion anyway (DE has stricter VAT rules)

**Cons:**
- Quarterly VAT declarations (more accountant work)
- VAT must be charged to LT B2C customers (slight friction for personal-use customers)
- Cash flow impact (collect VAT, pay VAT, net out monthly)

**My recommendation:** Voluntarily register VAT at M3 (when first paying customer comes online, even if revenue tiny). Reasons:
1. Most Longrein customers will be VAT-registered businesses (riding schools = SMBs with VAT)
2. Your accountant overhead increases ~€20/mo for VAT — manageable
3. You collect ~€800-€1,500 EUR/yr in input VAT refunds (Vercel, Supabase, etc. invoices have VAT you can reclaim)
4. Cleaner DACH transition

### EU VAT OSS (One-Stop Shop)

Once selling B2B to other EU countries (DACH expansion), EU VAT OSS handles cross-border VAT:
- Single quarterly return for all EU sales
- Charge customer's local VAT rate
- Remit via LT VMI (LT acts as your OSS gateway for entire EU)

**Setup:** automatic with VAT registration + OSS opt-in (one form at VMI).

**Trigger:** before first DACH paying customer (M18 per DACH playbook).

### B2C selling (consumer customers)

Longrein is B2B by design. But IF you ever sell B2C (e.g., individual horse owner pays for personal-use Longrein):
- Charge VAT at LT rate (21%)
- Subject to LT consumer protection law

Largely irrelevant for our model — we're 100% B2B.

---

## Dalis 4 — Cross-border considerations (PL, DE, etc.)

### Selling to Polish customers (M6+)

- Polish business customer pays NET amount + applies reverse-charge VAT in PL (their job)
- You charge €0 VAT but report transaction in EU OSS quarterly return
- No PL-specific tax obligations for you

### Selling to German customers (M18+ DACH)

- Same EU reverse-charge mechanism for B2B
- DE customers expect:
  - DE-language invoices (legally not required, but commercially essential)
  - **XRechnung** format for B2B (mandatory for German B2B since 2025)
  - VAT-EU-ID on invoice (you provide, they verify via VIES)
  - DSGVO-compliant data residency

**Action items:**
- M14: Stripe Invoicing supports XRechnung — verify configuration
- M14: DE-language invoice template designed (your DE hire's first task)
- M18: First DE customer = first XRechnung test

### Selling to Swiss customers (M30+ if pursued)

- CH is NOT EU — separate VAT system
- 7.7% Swiss VAT applies to services consumed in CH
- Requires Swiss VAT registration if sales >CHF 100,000/yr to CH
- BELOW that threshold — sell at 0% VAT, customer self-declares

**Action items:** defer to M30+ if CH is meaningful (currently small market for us).

### Selling to UK customers (post-Brexit)

UK is OUTSIDE EU now. UK VAT registration if sales >£85,000/yr to UK.

- Currently NOT a target market per business plan. Defer indefinitely.

---

## Dalis 5 — Trademark + IP protection

Already covered in initial setup but worth re-stating in legal context:

### Trademark filing strategy

**Phase 1 (M6, when first paying customer):**
- LT national trademark (Lietuvos Patentų Biuras): ~€180 fee, 6-month review
- Classes: 9 (software) + 42 (SaaS)
- Protects in LT only

**Phase 2 (M12, when MRR ≥€1,000):**
- EUIPO trademark: ~€900 fee, 4-6 month review
- Classes: 9 + 42
- Protects across all EU member states
- Includes DACH preparation

**Phase 3 (M30+, if expanding to UK or US):**
- UK trademark: ~£170 (UK no longer covered by EUIPO)
- USPTO refile (per memory — Hoof Pick LLC abandonment makes this possible)

### Domain protection

Already done by founder (per memory):
- longrein.eu (purchased) ✓
- longrein.lt (purchased) ✓
- longrein.de, .at, .ch (defensive — purchase M6 before DACH announcement)

### Source code IP

LT default rule: code created by founder = founder's IP (you).
LT default rule: code created by employees = employer's IP (you, if/when hiring).

**Recommended:**
- IP Assignment Agreement signed when hiring DACH person (M14): „all IP created in scope of work belongs to UAB Longrein."
- IP Assignment Agreement for any freelancers (e.g., logo designer, dev contractors): same template.

Templates available from LT lawyer (~€100 one-time for template draft).

---

## Dalis 6 — Privacy, GDPR, and DPA (Data Processing Agreements)

### GDPR baseline

LT companies must comply with GDPR for:
- Personal data of EU residents (your customers AND their clients)
- Data residency considerations
- Breach notification (72 hours)
- Right to access, deletion, portability

**Practical Longrein actions:**
- ✅ Privacy Policy on landing (already drafted via Termly per parallel chat)
- ✅ Cookie banner (parallel chat working on)
- ✅ Data Processing Agreement (DPA) template for B2B customers

### DPA — when needed

When customer signs up, technically Longrein is „data processor" handling their „data subjects" (their riders/clients).

Customer (especially Mittelständler DE customers, larger LT yards) may request DPA before signing.

**Action:** create DPA template (LT lawyer ~€300-€500 one-time draft, EN+DE versions).

**Trigger:** first customer asks for DPA (likely M9-M15).

### Data residency

Currently: Supabase EU region (Frankfurt) hosts all data.
DSGVO-compliant.

If customer requests data residency in their country (e.g., DE customer wants data in DE) — currently NOT supported. Defer to enterprise tier (Year 3+).

---

## Dalis 7 — Founder agreements (relevant if hiring)

When hiring first DACH person (M14):

**Required documents:**
1. Employment contract (DE-format, DE-compliant if employee in DE; LT-format if employee in LT)
2. NDA (Non-Disclosure Agreement)
3. IP Assignment Agreement
4. Compensation structure (salary + benefits + equity if any)

**Equity considerations:**
- If hiring DE person at €40K/yr (below market), can offset with equity
- Standard early-stage SaaS: 0.5%-2% for first hire
- LT phantom equity (kompensacijos opciono planai) is legally complex — consult lawyer

**Recommended for first hire:**
- Cash-only compensation (no equity) — keeps simple
- Annual review for raise / bonus
- 3-month probation period (LT standard)

---

## Dalis 8 — Konkretūs šios sav. veiksmai (legal/business setup)

Eilė pagal būtinumą:

### Šią savaitę (must-do)

1. **Register individuali veikla via VMI** (~30 min, free)
   - https://www.vmi.lt → „Mano VMI" → „Individuali veikla"
   - KEAP codes: 62.01.0, 62.02.0, 63.11.10
   - Start date: today

2. **Open Revolut Business account** (~20 min, free)
   - https://www.revolut.com/business
   - Use longrein.team@gmail.com as account email
   - Apply for EUR + USD accounts (USD for future US customers)

### Šį mėnesį (should-do)

3. **Find LT accountant** (~2 hours research + interview)
   - Search LinkedIn / Notion (LT) for „SaaS apskaitininkas"
   - Interview 2-3 candidates
   - Pick monthly fixed-fee arrangement (€60-€100/mo)
   - Sign service agreement

4. **Voluntary VAT registration** (~30 min, your accountant handles)
   - Trigger: when first paying customer comes online (M6)
   - Form via VMI „PVM mokėtoju registracija"

5. **Create initial DPA template** (~€300-€500 lawyer cost)
   - One-time investment in template that scales to all customers
   - EN version primary, DE version for DACH M18

### M3-M6 (medium-term)

6. **LT national trademark filing** (~€180, 6 mo review)
   - Trigger: first paying customer
   - Classes 9 + 42

7. **First customer contract template** (Terms of Service hardening)
   - When customer #11 (first paying) onboarded
   - Lawyer review of B2B SaaS terms (~€500)

### M12-M18 (longer-term)

8. **Convert individuali veikla → UAB** (~€500-€1,500, 2-4 weeks)
   - Trigger: MRR ≥€2,000 OR planning DACH hire OR DPA volume requires liability protection

9. **EUIPO trademark filing** (~€900, 4-6 mo review)
   - Trigger: MRR ≥€1,000 (financial discipline justifies cost)

10. **Hire DACH Customer Success Lead** (employment contract + IP assignment)
    - Trigger: per DACH playbook M14 decision gate

---

## Dalis 9 — Common founder legal mistakes (NEdaryti)

1. **„I'll deal with structure later"** — by M9 it's a nightmare to migrate. Set up correctly Day 0.

2. **„My accountant will tell me about VAT"** — accountants do filing, NOT strategy. You decide when to register. They don't volunteer „you should register voluntarily" — they wait for you to ask.

3. **„I trust my customer, no contract needed"** — until disagreement. Always have written terms (even if just signed Terms of Service via signup checkbox).

4. **„Friends/family don't need agreements"** — especially they do. Money + relationships need clear paperwork.

5. **„IP is automatically mine"** — for code YOU write, yes. For freelancer/contractor code, NO without IP Assignment Agreement.

6. **„DPA is just paperwork"** — DPA is contractually how you commit to GDPR compliance. If you breach without DPA, customer can claim much more in damages.

7. **„One lawyer for everything"** — different lawyers for different things. SaaS B2B contracts ≠ trademark filings ≠ employment law. LT has lawyers specializing in each.

---

## Dalis 10 — Recommended LT professional support team

Build over Year 1 (NE Day 1, NE all at once):

### Tier 1: Must-have by M3
- **Accountant** (~€60-€100/mo) — monthly P&L, quarterly tax declarations, year-end filing
- **Personal lawyer for one-off advice** (~€80/hr, used 5-10 hrs/yr) — ToS review, DPA template, edge questions

### Tier 2: Should-have by M6
- **Bank business banker** (free with Revolut Business OR Swedbank Business) — for cash flow conversations, future loan options

### Tier 3: Nice-to-have by M12
- **B2B SaaS-specialized lawyer** (~€150/hr, used 15-30 hrs/yr) — bigger contracts, partnerships, IP enforcement
- **Trademark attorney** for EUIPO filing (one-off, ~€500 service fee on top of state fees)

### Tier 4: Required if hiring (M14+)
- **Employment lawyer** (~€100/hr, used 5-10 hrs total) — hire setup, employment contracts, DACH cross-border employment law

### Total professional services budget Year 1:
- Accountant: €60 × 7 mo = ~€420
- Lawyer (general): ~€500 (5 hrs)
- Trademark: ~€180 (LT national filing)
- DPA template: ~€400
- **Total Year 1: ~€1,500**

This is in our financial model expense line. Reasonable.

---

## Dalis 11 — Honest assessment

LT business setup is genuinely founder-friendly compared to most countries:
- Individuali veikla setup in 30 minutes online
- 5% tax rate at small revenue tier
- 0% corporate tax for first 2 years if revenue <€300K
- Strong VAT framework with EU OSS for cross-border
- Active startup ecosystem (Tech Forum, Practica Capital, Open Circle)

The biggest mistake LT founders make: NOT setting up a business at all („I'm not making money yet, why register"). Then revenue starts coming in via personal account, accountant has nightmare to clean up year-end, taxes are higher than necessary because expenses weren't tracked.

**My absolute recommendation:** Register individuali veikla TODAY. Open Revolut Business TODAY. Start treating Longrein as a business from Day 0, not from when revenue crosses some threshold.

The 50 minutes you spend now save 50 hours of cleanup later.

---

*Šis dokumentas live'as. Atnaujinti po LT accountant + lawyer onboarding'o (jie gali turėti specifinių LT corner case'ų insights). Įkelti į Drive `01_Legal/`.*
