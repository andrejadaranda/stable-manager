# Stripe invoices + receipts — brand setup

Stripe handles every transactional document we send (trial start
receipt, monthly recurring invoice, payment receipt, dunning email,
refund email). The default look is generic blue-Stripe — fine for
testing, off-brand for Founding 15. Twelve minutes in the Dashboard
makes them feel like Longrein.

This is **NOT something that ships via code** — every setting below
lives in Stripe Dashboard and applies to all invoices going forward.
Existing invoices (if any) keep the old branding because Stripe
renders them at issue time.

---

## Where it lives

All settings are under **Stripe Dashboard → Settings → Business
settings**. The three pages that matter:

1. **Branding** (`/settings/branding`) — visual identity on hosted
   pages + email + PDF
2. **Public details** (`/settings/account`) — sender name + support
   info that appears in the email footer and on every receipt
3. **Customer emails** (`/settings/billing/emails`) — when Stripe
   sends invoices/receipts on our behalf
4. **Invoice template** (`/settings/billing/invoice`) — memo, footer,
   and payment instructions on PDF invoices

---

## 1. Branding

**Logo** — square 512×512 PNG on transparent background.
Use the dark-on-cream version (the same one in the Vercel deploy
landing/index.html `<img class="logo">`). White-on-cream will look
muddy on Stripe's white email background.

**Icon** — 32×32 PNG (browser favicon equivalent) for the Checkout
page tab title.

**Primary colour** — paste `#1E3A2A` (brand-700 / our hunter green).
Stripe uses this for buttons on Checkout + the receipt header bar.

**Accent colour** — paste `#F4663D` (brand orange) for secondary
buttons. Optional but worth doing.

---

## 2. Public details

These show on every email + at the bottom of every receipt PDF
("Issued by …").

- **Business name**: `Longrein`
- **Support email**: `hello@longrein.eu` (Resend-verified domain —
  bounces feed back into our inbox)
- **Support phone**: leave blank for now — adding one creates an
  expectation we can't meet during Founding 15
- **Statement descriptor** (max 22 chars): `LONGREIN STABLE` — this
  is what shows on the cardholder's credit card statement. Has to
  pass Stripe review (1–3 business days the first time).
- **Statement descriptor (short)** (max 10 chars): `LONGREIN`

---

## 3. Customer emails

Enable **all four** Stripe-sent emails:

- ☑ Successful payments → "Receipt for your Longrein subscription"
- ☑ Subscription trial ends → 3 days before trial converts (we ALSO
  send our own branded one via Resend; Stripe's is a belt-and-braces
  backup in case our webhook fails)
- ☑ Failed payments → dunning, retries 3× before cancel
- ☑ Customer subscription updates → cancellation confirmation, plan
  changes

For each, the **from address** should read `hello@longrein.eu`
(NOT `noreply@stripe.com`). Stripe routes through their own SMTP
but the visible sender is ours.

---

## 4. Invoice template

**Default memo** (shows above line items on every invoice):
```
Thank you for being a Longrein stable. If anything's unclear
about this invoice, reply to hello@longrein.eu and we'll fix it
the same day.
```

**Default footer** (small print at the bottom of every PDF):
```
Longrein — Vilnius, Lithuania — longrein.eu
VAT: [add when registered]
```

**Custom fields** (optional, shows in the invoice header). Useful for
larger stables that need to match invoices to internal cost centres:

- Field 1: `Stable ID` — pulls from subscription metadata `stable_id`
- Field 2: `Period` — pulls from `subscription_data.description`

---

## What ships in code

The code-side companion (already deployed):

- Each new subscription gets a human-readable `description`:
  `Longrein — equestrian stable management for {Stable Name}` —
  surfaces on every invoice line so the owner sees what they're
  being charged for.
- Each subscription carries `metadata.stable_id` so the invoice
  template's custom fields can pull it through.
- Stripe Checkout shows a Longrein-toned `custom_text` block above
  the Pay button: "You'll only be charged after the 14-day trial"
  + a required terms-of-service consent box pointing at our /terms.

---

## Test it

1. Open Stripe Dashboard in **Test mode**
2. Apply every setting above to the test environment first
3. Run a complete trial signup against
   `app.longrein.eu/dashboard/settings/billing` (use 4242 4242 4242 4242)
4. Wait 10 seconds — receipt email lands in `hello@longrein.eu`
5. Open the test customer in Dashboard → click "Send invoice" on the
   pending subscription → check the PDF look

If anything's off, fix it in Test, then re-apply every change to
**Live mode**. Test and Live brand settings are independent.

---

## Out of scope (post-Founding 15)

These need more product thought + per-stable customisation:

- **Per-stable invoice branding** — each owner sees Stripe-branded
  invoices for THEIR subscription, but THEIR clients' invoices (from
  our internal Payments table) currently use the in-app `print invoice`
  flow, not Stripe. When we build white-label invoices for stables in
  M3 (autumn), that's a much bigger workstream — separate Stripe
  Connect account per stable, restricted_keys, etc.
- **Email template overrides** — Stripe's defaults are good for v1.
  When we have 100+ paying stables, customise via the Email Studio API.
- **Multi-currency display** — locked to EUR for Founding 15.
  Add USD + GBP when the first non-EU stable signs up.
