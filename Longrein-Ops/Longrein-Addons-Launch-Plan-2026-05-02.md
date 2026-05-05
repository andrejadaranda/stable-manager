# Longrein — Add-ons Launch Plan (M6 expansion engine)

**Klausimas:** Kaip add-ons sukursi second engine of revenue, ne curiosity?
**Recommendation:** Launch'inti 4 add-ons M6 (~Lapkritis 2026), kai turi 30+ paying customers + product stability + bandwidth servisuoti. ARPU lift target: +€7.70/customer/mo = **+€92/customer/yr = +€18K MRR per 200 customer'ių cohort'ą.**
**Critical insight:** add-ons NEpadeda grow customer count'ą — jie pakelia EXISTING customer'ių LTV. Tai second growth engine virš core pricing'o.

---

## TL;DR

4 add-ons launching M6:
1. **SMS reminder pack** — €5/€19/€59 per tier (100/500/2000 SMS)
2. **Accountant CSV/XML integration** (Rivilė, Centas, ProfitFlow) — €9/mo
3. **Custom domain for public stable page** (book.youryard.lt) — €5/mo
4. **Extra client portal seats** above 50 active — €0.50/seat/mo

Expected attach rates (industry benchmarks vertical SaaS):
- SMS: 35% attach × avg €12/mo = €4.20 ARPU lift
- Accountant: 25% attach × €9/mo = €2.25 ARPU lift
- Custom domain: 10% attach × €5/mo = €0.50 ARPU lift
- Extra seats: 15% attach × avg €5/mo = €0.75 ARPU lift
- **Total: +€7.70/customer/mo = +€92/customer/yr**

Math at scale:
- 50 customers (M9): +€385 MRR (€4.6K ARR)
- 100 customers (M14): +€770 MRR (€9.2K ARR)
- 200 customers (M22): +€1,540 MRR (€18.5K ARR)
- 500 customers (M48): +€3,850 MRR (€46.2K ARR)

Add-ons effectively raise blended ARPU from €87 (core) to €95 (core + add-ons). Significant compounding.

---

## Dalis 1 — Why add-ons NOW (M6) vs LATER (M12)

### M6 launch reasoning

By M6:
- ~30 paying customers (per financial model)
- Core product proven (FM beta + first paying cohort validated)
- Add-on infrastructure cost spread over base
- Customer success patterns identified (you know what they ask for)

### Why NOT earlier (M3-M5)

Founding Members (still in 12-mo free) shouldn't see add-on charges — that breaks the FM offer trust. Plus pre-30-customer base — too small to justify build cost.

### Why NOT later (M12+)

By M12, customers have established workflows. Adding €15-€20/mo to existing customer = friction (even if they want the feature). M6 = customers still in early-adoption phase, willing to expand commitments.

### Decision trigger

LAUNCH add-ons on M6 IF:
- ≥25 paying customers
- Core product NPS ≥40
- Founder bandwidth has 1 day/week for add-on management
- 3+ customer requests for at least 1 of the 4 add-ons (validates demand)

POSTPONE if:
- <20 paying customers
- Active product stability issues
- Founder >55 hrs/wk (per burnout trigger)

---

## Dalis 2 — Add-on #1: SMS Reminder Pack

### Feature scope

Send automated SMS reminders to clients:
- Day-before lesson reminder (24h prior)
- Optional: morning-of lesson reminder (3h prior)
- Auto-reply handling: client replies „CONFIRM" or „CANCEL"
- Cancel auto-frees slot for waitlist (potential add-on within add-on)

### Tier pricing

```
SMS Reminder Pack

100 SMS/month   €5/mo    (€0.05/SMS effective)
500 SMS/month   €19/mo   (€0.038/SMS effective — 24% discount)
2000 SMS/month  €59/mo   (€0.030/SMS effective — 40% discount)

Overage: €0.10/SMS (intentionally high to push upgrade to next tier)
Unused SMS expire end-of-month (no rollover — predictable cost basis)
```

### Implementation

**Backend:** Twilio API (or Vonage / MessageBird as fallback)
- LT SMS rate ~€0.04/SMS sent (Twilio EU)
- PL SMS rate ~€0.03/SMS sent
- DE SMS rate ~€0.06/SMS sent

**Margin analysis:**
- Customer 100 SMS pack: revenue €5, cost ~€4-€6 (depending on country mix), margin ~€0-€1 (negligible — customer acquisition tool, not profit)
- Customer 500 SMS pack: revenue €19, cost ~€20-€30, margin ~-€1 to -€11 (LOSS at higher tiers — bad pricing)

**WAIT — let me recalibrate:**
- 500 SMS × €0.04 = €20 cost
- Customer pays €19 for 500 SMS = LOSS of €1
- 2000 SMS × €0.04 = €80 cost
- Customer pays €59 for 2000 SMS = LOSS of €21

This pricing model loses money at higher tiers!

**Corrected pricing (with 50% gross margin minimum):**

```
SMS Reminder Pack (revised)

100 SMS/month   €9/mo    (cost €4-€6, margin €3-€5, ~50% margin)
500 SMS/month   €29/mo   (cost €20-€30, margin €0-€9 — TIGHT)
2000 SMS/month  €99/mo   (cost €80-€120, margin -€21 to €19 — STILL LOSS RISK)
```

**Actually best approach:** Pure pass-through pricing + flat platform fee:

```
SMS Reminder Pack (final — pass-through model)

Activation: €9/mo flat (covers Twilio account, integration, support)
Per SMS: €0.07/SMS sent (covers cost + 75% margin)

Example: 100 SMS month = €9 + (100 × €0.07) = €16/mo
Example: 500 SMS month = €9 + (500 × €0.07) = €44/mo
Example: 2000 SMS month = €9 + (2000 × €0.07) = €149/mo
```

**Pros:** sustainable margin, transparent, scales with usage
**Cons:** harder to predict customer cost (each customer different volume)

**RECOMMENDATION:** flat-tier model BUT calibrated to cover cost + margin:

```
SMS Reminder Pack (locked)

Starter SMS:  €15/mo flat — up to 200 SMS/mo
Growth SMS:   €39/mo flat — up to 800 SMS/mo
Pro SMS:      €99/mo flat — up to 2,500 SMS/mo

Overage: €0.10/SMS
Unused SMS expire end-of-month
```

Math: Starter @ 200 SMS = €15 revenue, ~€8 cost, €7 margin (47%) ✓

### Attach rate prediction

35% attach rate (industry benchmark for B2B SaaS reminder add-ons):
- 50 customers @ 35% = 17 SMS-active customers
- 100 customers @ 35% = 35 SMS-active customers
- 200 customers @ 35% = 70 SMS-active customers

Mix by tier (predicted):
- 60% Starter (€15) = €9 weighted average
- 30% Growth (€39) = €11.70 weighted average
- 10% Pro (€99) = €9.90 weighted average
- **Avg revenue per SMS-active customer: ~€31/mo**

Updated ARPU lift calc:
- 35% attach × €31/mo = **€10.85/customer/mo ARPU lift** (corrected from earlier €4.20)

### When to launch

M6 (Lapkritis 2026), simultaneous with first paying customer cohort onboarding.

---

## Dalis 3 — Add-on #2: Accountant CSV/XML Integration

### Feature scope

Auto-export Longrein financial data in formats compatible with LT/PL/DE accounting software:
- **Rivilė** (LT — most common LT accounting tool)
- **Centas** (LT — alternative)
- **ProfitFlow** (LT — modern SaaS accounting)
- **iFirma** (PL — Polish equivalent)
- **DATEV** (DE — when DACH live, Year 2)

Monthly automated export sent to accountant email + downloadable in-app.

### Pricing

```
Accountant Integration: €9/mo flat
```

Simple, predictable. Most customers will activate when their accountant requests it (this is a HIGH-leverage acquisition trigger — accountant pushes customer to subscribe).

### Implementation

**Backend:** ETL job per customer per accountant tool. Standard CSV format for Rivilė/Centas (LT VMI standardized). XML format for DATEV.

**Effort:** ~2 weeks dev work for first integration (Rivilė). Subsequent integrations ~3 days each (formatting variations).

**Margin:** essentially 100% margin (no per-transaction cost). Pure platform play.

### Attach rate prediction

25% attach rate:
- 50 customers @ 25% = 13 active
- 100 customers @ 25% = 25 active
- 200 customers @ 25% = 50 active

ARPU lift: 25% × €9/mo = **€2.25/customer/mo**

### Why this matters strategically

When customer activates accountant integration, switching cost grows dramatically:
- Customer's accountant configures tool around Longrein exports
- Switching to competitor = re-training accountant + re-formatting historical data
- Effective lock-in increases churn protection

### When to launch

M6 alongside SMS pack. Together: stronger value prop.

---

## Dalis 4 — Add-on #3: Custom Domain for Public Stable Page

### Feature scope

Default: stable's public page at `longrein.eu/s/your-stable-name`
Custom domain: `book.your-stable.lt` (or similar — customer's own domain)

Includes:
- DNS setup support
- SSL certificate provisioning (auto-Let's Encrypt)
- Multi-domain support (book.yard.lt + reservations.yard.lt)

### Pricing

```
Custom Domain: €5/mo per domain
```

Cheap, but premium positioning. „Real stables have their own URLs."

### Implementation

**Backend:** Vercel custom domain support (already exists for app). Map customer's CNAME to Longrein's hosted page subdomain.

**Effort:** 3 days dev work + customer support docs for DNS setup.

**Margin:** ~95% (Vercel custom domain $0/mo, Let's Encrypt free).

### Attach rate prediction

10% attach rate (premium feature, not everyone needs):
- 50 customers @ 10% = 5 active
- 100 customers @ 10% = 10 active
- 200 customers @ 10% = 20 active

ARPU lift: 10% × €5/mo = **€0.50/customer/mo**

### Strategic role

Lower direct revenue impact, but high brand-prestige signal. Customer using custom domain = serious operator + ambassador.

Marketing benefit: showcase custom domains in case studies („their booking lives at book.elite-stables.lt").

### When to launch

M9 (3 mo after SMS + accountant — secondary priority).

---

## Dalis 5 — Add-on #4: Extra Client Portal Seats

### Feature scope

Default plan includes 50 active client portal seats per stable (where „active" = logged in within last 30 days).

Beyond 50:
- Customer alerted via dashboard
- Option to add seats: €0.50/seat/mo (each additional 25 seats = €12.50/mo)

### Pricing

```
Extra Client Portal Seats:

Tier 1: 51-75 seats   = +€12.50/mo
Tier 2: 76-100 seats  = +€25/mo
Tier 3: 101-150 seats = +€50/mo
Tier 4: 151+ seats    = custom pricing (Premium)
```

Aligns with yard scale — only larger operations hit cap, only larger operations pay.

### Implementation

**Backend:** simple count + paywall UI. Existing infrastructure.

**Effort:** 2 days dev work.

**Margin:** ~100% (no incremental cost beyond DB storage trivial).

### Attach rate prediction

15% attach rate (only larger yards hit cap):
- 50 customers @ 15% = 8 active (mostly Tier 1)
- 100 customers @ 15% = 15 active
- 200 customers @ 15% = 30 active

Mix:
- 70% Tier 1 (€12.50)
- 25% Tier 2 (€25)
- 5% Tier 3 (€50)
- Avg €17/mo per active

ARPU lift: 15% × €17/mo = **€2.55/customer/mo**

### When to launch

M9 alongside Custom Domain. These are „scale-stage" features — relevant when customers grow.

---

## Dalis 6 — Combined attach rate analysis

Per customer, combined add-on opportunity:

| Add-on | Attach % | Avg revenue if active | Per-customer ARPU lift |
|---|---|---|---|
| SMS pack | 35% | €31/mo | €10.85/mo |
| Accountant | 25% | €9/mo | €2.25/mo |
| Custom domain | 10% | €5/mo | €0.50/mo |
| Extra seats | 15% | €17/mo | €2.55/mo |
| **TOTAL** | | | **€16.15/customer/mo** |

This is HIGHER than originally modeled (€7.70). Reasons:
- SMS pricing recalibrated for sustainable margin (was underpriced)
- Combined attach ≠ overlap (some customers buy multiple add-ons)

Realistic ARPU lift estimate: **€10-€15/customer/mo** (€120-€180/customer/yr).

At scale:
- 100 customers: +€1,000-€1,500 MRR
- 200 customers: +€2,000-€3,000 MRR (€24K-€36K ARR)
- 500 customers: +€5,000-€7,500 MRR (€60K-€90K ARR)

---

## Dalis 7 — Stripe metered billing configuration

### Stripe products structure

Already setup (per Pricing v2):
- **Longrein Subscription** (per-horse metered)

Add to Stripe:
- **Add-on: SMS Starter** — flat €15/mo
- **Add-on: SMS Growth** — flat €39/mo
- **Add-on: SMS Pro** — flat €99/mo
- **Add-on: Accountant** — flat €9/mo
- **Add-on: Custom Domain** — flat €5/mo per domain (quantity-based)
- **Add-on: Extra Seats Tier 1** — flat €12.50/mo
- **Add-on: Extra Seats Tier 2** — flat €25/mo
- **Add-on: Extra Seats Tier 3** — flat €50/mo

### Customer billing UX

Customer sees in Settings → Billing:

```
Current Plan: Longrein Pro
- Per-horse subscription: 25 horses × €3.00 = €75/mo
- Annual discount: -25% = -€18.75
- Subtotal core: €56.25/mo

Active Add-ons:
- SMS Starter (200 SMS): €15/mo
- Accountant Integration: €9/mo

Total: €80.25/mo
Annual savings: €270/yr (vs monthly billing)
```

Clear, predictable, no surprises.

### Activation UX

Customer clicks „Activate" in app:
- Stripe Checkout opens (pre-populated for new add-on)
- Customer confirms (no payment if existing card on file)
- Add-on becomes active immediately
- Pro-rata billing for partial month

---

## Dalis 8 — Communication strategy to existing customers

When add-ons launch M6, you have:
- 10 Founding Members (free — DON'T pitch them yet)
- ~20-30 paying customers (recently joined)

### FM communication

Don't push add-ons to FM during 12-mo free period. They get notified at M9 QBR per FM Customer Success Playbook („add-ons are now available, here's overview, you'll have access free until M12").

### Paying customer communication

**Email blast (T-3 days before launch):**

```
Subject: Coming this week — three new ways Longrein supports your operations

[Vardas],

Three months in, you've told us what's working and what's missing. This week we're shipping the most-requested gaps as optional add-ons:

1. SMS reminders — automated client lesson reminders (€15-€99/mo depending on volume)
2. Accountant integration — auto-export to Rivilė/Centas/ProfitFlow (€9/mo)
3. Custom domain — your stable's booking page at book.youryard.lt (€5/mo)
4. Extra portal seats — for stables with 50+ active clients (€12.50/mo and up)

Each is optional. None are bundled. You activate from Settings → Billing when ready.

Why share now: I'd rather you know what's coming than be surprised. If you have feedback before launch — reply to this email.

Andreja
```

**In-app notification (Day-of-launch):**

```
🆕 Add-ons available
Three new options to extend your Longrein subscription. Browse from Settings → Billing.
```

**Launch day social posts:** integrated into LinkedIn + IG content per existing plans.

### Activation incentive (limited time)

First 14 days post-launch: 50% off first 3 mo of any add-on.

```
Limited promo (first 14 days):
SMS Starter: €7.50/mo for first 3 mo (then €15)
Accountant: €4.50/mo for first 3 mo (then €9)
```

Drives initial activation. After 14 days, normal pricing.

---

## Dalis 9 — KPIs and decision triggers

### Month 1 post-launch

Targets:
- 30%+ of paying customers activate at least 1 add-on
- 50%+ of activations are SMS pack (predicted highest attach)
- Average add-on revenue per activated customer: €15+/mo
- Churn rate steady (add-ons don't push customers away)

If hit: continue add-on roadmap, plan add-on #5 (M9).
If miss <20% activation: re-survey customers — pricing too high? feature unclear? technical friction?

### Month 6 post-launch

Targets:
- 35%+ overall attach rate (matches industry benchmark)
- Combined ARPU lift €10+/customer/mo
- Add-on revenue = 15%+ of total MRR

If hit: invest in add-on #5 (Twilio WhatsApp integration? Multi-language i18n add-on?)
If miss: pause new add-on development, focus on improving existing 4.

### Year 1 post-launch (M18 from launch day)

Targets:
- 50% attach on at least 1 add-on per customer
- Add-on revenue = 20%+ of total MRR
- 1 add-on becomes „can't-live-without" (referenced in customer testimonials)

---

## Dalis 10 — Add-on roadmap (post Year 1)

After 4 core add-ons established, expand:

**M12-M18:**
- **WhatsApp integration** — direct messaging from Longrein → client WhatsApp (BIG demand in LT/PL — €15/mo flat)
- **Bulk import / migration tool** — for stables switching from Excel (€19 one-time)
- **Advanced reporting / analytics** — dashboards for owner business intelligence (€25/mo)

**M18-M24:**
- **DACH-specific add-ons** — XRechnung export, DATEV integration, German VAT tools (€19/mo bundle)
- **API access** — for tech-savvy stables wanting custom integrations (€49/mo)
- **White-label client portal** — fully branded for premium yards (€39/mo)

**M24+:**
- **Lesson video recording integration** — store client lesson videos in Longrein (€29/mo)
- **Marketplace** — vet/farrier directory + integrations (€19/mo)

---

## Dalis 11 — Common add-on launch mistakes (NEdaryti)

1. **Underpriced add-ons** — losing money per usage = bad business. Calculate margin before launch.
2. **Bundling everything together** — kills flexibility. Keep add-ons SEPARATE.
3. **Auto-charging without explicit opt-in** — even small charges trigger churn if customer feels „taken advantage of."
4. **Launching before product stability** — add-ons amplify product issues (more touchpoints = more bugs).
5. **No analytics on attach rates** — can't optimize what you don't measure.
6. **Pushing add-ons to FM cohort during free period** — breaks trust.
7. **Limited-time promos that auto-renew at full price without warning** — illegal in EU consumer law (B2B less strict, but still bad practice).

---

*Šis dokumentas live'as. Atnaujinti po M6 launch'o (real attach rates vs projected). Įkelti į Drive `02_Product/strategy/`.*
