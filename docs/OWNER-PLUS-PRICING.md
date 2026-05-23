# Owner+ pricing strategy

Locked 2026-05-23. Implementation lands across tasks A→D + a new
Stripe price ID after the core client portal is stable.

## The model

```
                Klientas-RIDER           Klientas-HORSE OWNER       Privatus žmogus
                (joja stable's          (board's žirgą stable'e,    (jokio stable)
                 žirgus, ne owner)       klientas-portal)
                ────────────────         ──────────────────────     ──────────────────
Free            FOREVER per stable       BASIC per stable           —
                Lessons + sessions +     žiūri stable's tvarkaraštį
                payments + goals (3)     savo žirgo, sessions log,
                                         goals (3)
                                         
Owner+ €5/mo    —                        Vet records, expense log,  —
                                         photo album, document
                                         storage, vaccination
                                         reminders, PDF annual
                                         review

Personal €9/mo  —                        —                          1-2 horses
                                                                    Full app

Personal €15/mo —                        —                          3-5 horses
                                                                    Full app
```

## Founding 15 numbers

Per stable: ~25 horses → ~15 horse owners → 20% upgrade rate
= **3 horse owners × €5 = €15/mo extra per stable**

Across 15 Founding stables: **+€225/mo recurring**, on top of the
€25/mo Founding rate = **3x revenue per stable** vs the SaaS-only line.

## Upgrade triggers (where the no-brainer happens)

These moments naturally create "I want more" intent for a stable-linked
horse owner. Each gets a subtle in-UI "🔒 Owner+ €5/mo" CTA:

1. **Photos** — stable uploads lesson photos. Free tier shows 2 thumbs,
   gates the rest behind upgrade.
2. **Vaccination expiry warning** — push/email "Lola's tetanus boost
   expires in 2 weeks. Track it in your own records → Owner+".
3. **Boarding line item** — "Stable applied €350 boarding this month.
   Want to track YOUR purchases too (feed, supplements, transport)? → Owner+"
4. **Annual PDF review** (December) — "Get a printable summary of Lola's
   year. 🔒 Owner+"
5. **Vet visit logged by trainer** — "Add your own follow-up notes? → Owner+"
6. **Goals limit** — 4th goal triggers "🔒 Unlimited goals on Owner+"

## What's "free" intentionally compelling

The free tier must be USEFUL enough that the horse owner installs the
habit, otherwise they bounce. Free includes:

- Live calendar of their horse's stable activity
- Their own sessions log (when they ride)
- 3 personal goals
- Stable's view of vet visits + costs (read-only, summary)
- 2 lesson photos / month

If we ever tighten the free tier, Owner+ conversion would drop because
fewer owners would have a daily habit to upgrade from.

## Pricing psychology

- **€5/mo = espresso/day** — universally acceptable for hobbyist horse
  spending (vs €400/mo board, €5k horse purchase)
- **Annual €50/year** (17% discount) — encourages prepayment, smooths
  cash flow
- **First 30 days free** — every new horse-owner-client gets Owner+
  for free trial; converts on day 31 unless they cancel

## Conversion math

We need conversion of stable-linked owners → Owner+ to beat 8% for the
add-on to pay back its support cost. Comparable horse-industry SaaS
(EquineGenie, etc.) reports 15-22% B2C2B add-on conversion. Our edge:
the upgrade triggers fire only when the owner is already engaged with
their horse — not random outreach.

## When to ship

- **Phase 1** (this week): Free tier ships with EVERY client portal
  upgrade. UI shows "🔒 Owner+" placeholders on locked features but
  the upgrade button just opens a "Coming soon, May 30" modal.
- **Phase 2** (next week): Stripe Owner+ price product + Stripe Checkout
  trigger from the upgrade buttons + DB profile column
  `owner_plus_status` (none / trialing / active / cancelled). Feature
  gates unlock.
- **Phase 3** (June): Trigger emails + push notifications for the 6
  upgrade moments listed above. First conversion expected in Week 2.

## What this WON'T do

- It won't drive stable owner revenue (they pay €25-49/mo regardless).
- It won't replace the B2C Personal plan — those buyers don't have a
  stable, they need the full app from day one.
- It won't be visible to RIDER-only clients (they don't own a horse,
  no upgrade trigger possible).

## Decision log

- 2026-05-23: pricing locked at €5/mo (Owner+), €9/mo (Personal 2-horse),
  €15/mo (Personal 5-horse).
- 2026-05-23: free-tier scope locked at "useful but limited" — see
  matrix above.
- Phase 1 ships as part of Founding 15 portal launch.
