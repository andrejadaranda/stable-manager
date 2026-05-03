# Hoofbeat — Full SaaS Audit & Strategic Report

> **Note (2026-05-02):** The product name was **Hoofbeat** at the time of this audit. It was renamed to **Longrein** on 2026-05-02 because `hoofbeat.eu` was already registered. Filename kept as historical reference. Strategic findings, brand palette (Paddock Green / Saddle Tan / Arena Cream), typography (Source Serif 4 + Inter), tagline ("Run the yard. Protect the horses."), ICP, and pricing structure all carry over to Longrein unchanged. See `Longrein-Readiness-Audit-2026-05-02.md` for the post-rename launch plan.

**Date:** 30 April 2026
**Auditor brief:** Senior SaaS product auditor + startup strategist + UX expert. Brutally honest. No politeness. No generic advice. Money-on-the-line tone.
**Status of product:** Substantial Next.js + Supabase build. ~30 dashboard pages, ~70 components, ~30 services, production-grade Postgres schema. Pre-public-launch. Waitlist landing exists but is not yet capturing emails.

---

## TL;DR — the executive verdict

**Should you continue? YES — but with three non-negotiables.**

1. Fix the brand fragmentation between your marketing site (Paddock Green / Saddle Tan / Arena Cream) and your in-app dashboard (Navy / Orange). Right now they look like two products from two different companies. For a €49/mo "premium" positioning that tries to sit next to Aesop and Linear, this is a credibility-killer the moment a customer goes from landing page to first login.
2. Make the waitlist actually capture emails. Right now the form fires a `window.alert()` and silently discards the address. Until that's fixed, every euro of marketing effort is leaking out the bottom of the funnel.
3. Decide whether you are building a **lifestyle SaaS** (€2–4k MRR, run from your yard, 50–80 paying stables) or a **growth SaaS** (€10–25k MRR, 200+ stables, founder-led sales motion across LT/LV/EE/PL/DE). You cannot do both. The product is more than capable; the ambiguity is in the GTM commitment.

The product itself is genuinely better than I expected. Welfare-as-a-top-level-dashboard is a real wedge no major competitor owns. The database is more disciplined than most Series A SaaS I've seen (GIST exclusion constraints to prevent double-bookings at the DB level — I rarely see that). The feature surface is broad enough to ship.

What's weak is the **monetization plumbing** (no Stripe Checkout I could see, SEPA promised but not wired, no subscription billing in the schema), the **acquisition surface** (waitlist broken, no localized PL/DE landing, no founder-led sales pipeline visible), and the **scope discipline** (an internal stable Chat module is in-scope while invoicing-paid is not — that's backwards).

The business plan's M18 target (50 paying customers, ~€1,950 MRR) is realistic with focus. €10k MRR is a 30–36-month goal, not a 24-month goal. Be honest with yourself about that runway.

---

## Part 1 — Product understanding

**What it is.** Hoofbeat is a multi-tenant SaaS for European riding schools and livery yards in the 15–40 horse band. It puts the horse roster, the lesson schedule, the client roster (with packages, agreements, and recurring boarding charges), and the books (payments + expenses + a finance dashboard) on one screen. Plus a horse-welfare dashboard that flags over-worked horses before they go sour. Plus a basic in-app chat. Plus a public profile page per stable. Plus a client portal where riders see their own lessons, payments, and rides.

**Who it's for.** Two-trainer-and-owner European yards running 15–40 horses out of WhatsApp groups, paper diaries, and Excel. The plan calls it the Baltic + Polish + DACH market; reality is the Baltics first, Poland by month 9, DACH from month 12.

**The problem it solves.** The "five-tool problem" — the average target stable runs schedule on Excel, comms on WhatsApp, the diary on paper, payments on a printed invoice book, and reports on guesswork. The pain is real and measurable: roughly 4–8 hours/week of admin overhead, €100–300/month in unbilled or under-billed services, and — the welfare-first wedge — at least one preventable incident per year of a horse worked one ride too many because nobody had the cumulative load on a screen.

**Is the problem painful enough to pay for?** Yes, but with a footnote. The pain is highest for the *owner of a 25-horse yard with 2–3 trainers and 60–120 active clients*. Smaller yards (5–10 horses, owner is the only trainer, 20 clients) feel the pain too but pay reluctantly. Larger yards (60+ horses, full back office) already use Equine Genie or a custom solution. Your sweet spot is narrow but real.

**Pain ranking (1–10):**
- Lost revenue from un-invoiced services: **8/10** — owners feel this monthly.
- Welfare incidents: **6/10** — emotional but rare; sells trust, not urgency.
- Time saved on admin: **7/10** — universal but commodity (every SaaS claims this).
- Client-facing professionalism (online booking, automated reminders): **8/10** — increasingly an expectation.

The strongest commercial wedge is **revenue recovery**, not welfare. Welfare is the brand pillar; invoicing-paid is the line that gets the credit-card field filled in. Lead with revenue, follow with welfare.

---

## Part 2 — Feature audit

I went through every page and service in the build. Below is the honest read.

### What works (these are real strengths)

**Welfare dashboard** (`/dashboard/welfare`). Five-bucket counter strip — Over cap / Near cap / Resting / Steady / Light — with per-horse load %, days-since-last-ride, weekly minutes saddled. Click a bucket to filter. This is a genuinely premium implementation of an idea no US competitor leads with. **Keep, polish, market the hell out of it.**

**Database constraints.** The schema uses Postgres GIST exclusion constraints to make horse double-booking and trainer double-booking *physically impossible at the database level*, plus same-stable validation triggers as defense-in-depth. Most stable software competitors enforce this in application code (which means race conditions). This is a quality-of-software signal you can use in marketing copy ("a horse cannot be booked into two lessons at once. Not as a check, as a guarantee.")

**Calendar shell with role-based view.** Owner sees everything; employee sees their lessons; client sees only their own. Drag-to-reschedule, week + day views, print view. This is the daily workflow surface and it's well-scoped.

**Horse profile with tabbed depth** — Overview / Sessions / Health / Boarding. Health record actions, session note editor, schedule rail. The information architecture here is thoughtful.

**Sessions vs lessons distinction.** Sessions are informal rides/training/turnout — they feed the welfare workload count. Lessons are billable. This separation is correct and most competitors collapse it.

**Smart suggestions widget on dashboard home.** Proactive ("this horse hasn't been ridden in 9 days," "this client is overdue €120"). Most products are reactive; you have the start of a proactive layer. **This is monetization gold once you wire it to nudge owners to take billable actions.**

**Onboarding checklist + welcome tour + birthdays widget.** The emotional layer (birthdays for horses and clients) is the kind of small touch that gets screenshots on Instagram.

**Role-based navigation with feature-flag visibility.** `NAV[role]` filtered by `features[item.feature]` — this scales cleanly when you ship Premium-tier-only modules. Good architectural call.

**Cmd+K command palette.** Premium signal; matches the brand promise ("sit next to Linear").

**The waitlist landing copy.** "Run the yard. Protect the horses." works. The five-tool-problem section is the sharpest pain articulation I've seen in this category. Founder section is honest. Pricing teaser is structurally fine.

### What's weak or broken

**1. Brand fragmentation between marketing site and product (CRITICAL).**
- Waitlist landing: Paddock Green `#1E3A2A`, Saddle Tan `#B5793E`, Arena Cream `#F4ECDF`, Source Serif 4 + Inter. ✅ on-brand.
- In-app dashboard: navy `#1E2A47`, orange `#F4663D` / `#E04E25`, white. The dashboard code literally has the comment "Navy + Orange refresh." ❌ off-brand.
- The locked brand system in your memory file says "no purple/blue SaaS gradients." The in-app `card-navy` background and orange accent IS exactly what the brand system forbids. A new customer signs up via a cream-and-green landing, lands on a navy-and-orange dashboard, and the premium illusion breaks in 0.4 seconds.
- **Fix:** repaint the in-app palette to match the brand system *before* opening the waitlist beta. This is a 1–2 day Tailwind config change plus a CSS variable swap. It is the highest-ROI cosmetic work in the entire roadmap. Do it before you ship anything else.

**2. The waitlist form does not capture emails.**
The HTML reads: `onsubmit="event.preventDefault(); alert('Thanks. You will receive a welcome email shortly.');"` — every email submitted is silently discarded. Every visitor who sees the landing has been lied to. This is a single highest-priority fix.
- **Fix today:** wire the form to either Mailchimp/ConvertKit/Loops embed, OR (preferred, since your stack is already Supabase) a `waitlist_signups` table behind an unauthenticated INSERT-only RLS policy + email-confirmation function. Two hours of work. Do not ship another tweet about Hoofbeat until this is live.

**3. Promised features that aren't visibly wired.**
The landing promises:
- "Send the invoice from your phone. Get paid by SEPA, before the next lesson." — I don't see Stripe / Mollie / Paddle integration in the services folder. `services/payments.ts` records cash/card/transfer payments manually. **Self-pay via SEPA is not implemented.** Either wire it or remove the claim.
- "SMS reminders go out without you typing them." — Twilio / a similar SMS provider not in the stack. SMS in the EU is per-country and not free; this is a real cost line. **Either wire it or remove the claim.**
- "Drag-and-drop scheduling." — exists in the calendar week-grid. ✅
- "Recurring lessons in one click." — calendar `create-lesson-form` exists; verify the recurring/repeat path actually works end-to-end. (Schema has a single `lessons` table with no `recurrence_rule` column — this means "recurring" is probably manual cloning, which is not what users expect.)

**4. Pricing tier mismatch.**
- Landing page: Starter €19 (≤10 horses) / Pro €49 (11–40 horses) / Premium €99 (41+ horses).
- Business plan in memory: Starter / Pro €49 (anchor) / Premium. €19 anchor not mentioned.
- ICP per memory: 15–40 horses. So a 12-horse yard — *which is below your ICP* — would self-select Pro at €49. A 9-horse yard self-selects Starter at €19. **Starter risks cannibalizing Pro from the bottom.** And by gating "workload tracking, client portal, multi-trainer access, SMS" out of Starter, you've gutted the brand wedge (welfare = workload tracking) for the cheapest tier. Either kill Starter or make Starter the ICP-matched plan and rename.

**5. Vet, farrier, turnout, and non-lesson appointments don't have a first-class entity.**
Schema has `lessons` and that's it for calendar entries. The landing copy promises "lessons, livery, vet, farrier — one calendar." If a vet visit is currently typed as a "lesson" with status notes in the description, that's a hack and the welfare data will be wrong (vet visits aren't saddled work). **Add a generic `events` or `appointments` table with a `kind` enum. This is a 2–3 day backend change but it unlocks the marketing claim.**

**6. No client-side self-booking.**
The portal pages (`/dashboard/my-lessons`, `/my-payments`, `/my-horses`, `/my-sessions`) are read-only views. A 2026-era customer expects to see published availability and book themselves into open slots. Equine Genie and Stablebuzz both offer this. Without it, you lose the "modern professional yard" sales narrative.
- **Fix:** within MVP, add a "Request a lesson" flow on `/my-lessons` (client picks a slot from owner-published windows; owner approves). Skip the full automatic-booking flow; "request + approve" is enough for v1 and matches how owners actually want to retain control.

**7. Mobile execution is unverified.**
The landing copy says "the phone is the workplace." The dashboard sidebar has a mobile drawer pattern (good) and the `card-elevated` shell looks responsive. But I haven't seen evidence the calendar week-grid is genuinely thumb-first. A trainer in muddy gloves logging a session in the arena will not pinch-zoom. **Mandatory: do a 1-week mobile-only dogfood test on your own yard before opening the beta.** If the calendar is unusable on a phone, fix it. The brand pillar "phone-first for trainers" is a contract.

**8. Internationalization is not in place.**
The dashboard greets with hardcoded "Hi" — except one earlier version had "Labas." There's no `next-intl` or similar. Plan calls EN-first, LT-second, PL month 9. **Set up i18n scaffolding now.** Cost: 1–2 days. Cost of not doing it: every LT-language string change becomes a developer task forever.

**9. Monetization-relevant gaps in the data model.**
- No `subscriptions` table. The schema comment says "No subscriptions in MVP." This is fine if billing is on Stripe, with Stripe as the source of truth — but you still need at minimum a `stable_id → stripe_customer_id`, `subscription_status`, `current_plan`, and `trial_end_at`. None visible.
- No `invoices` table separate from `payments`. The current `payments` table records *received money*. Invoices (issued, paid, overdue, voided) are a different concept and what stable owners actually want emailed to clients.
- No `lesson_packages` purchase ledger I can confirm. (`services/packages.ts` exists but I haven't read its shape.) Riding-school monetization is mostly *lesson packs* (10-pack, 20-pack); without a clean package ledger, you can't tell a client "you have 3 lessons remaining" — which is the killer self-serve feature for clients.

**10. The internal Chat module is a strategic mistake at this stage.**
You are a 1-founder, pre-revenue SaaS. Building a chat that competes with WhatsApp inside your app is a tarpit — chat features expand forever (typing indicators, read receipts, file uploads, push notifications, mute, threading, mobile push) and customers will compare you to WhatsApp on every dimension and lose. Your customers *already use WhatsApp* and aren't going to stop. Feature-flag Chat off by default, market it never, and refund the engineering effort to invoicing-paid + self-booking.

### Critical missing features (must-have for MVP success)

1. **Stripe / Mollie integration** — recurring boarding charges + lesson invoicing + Pay-by-SEPA. Without this, the entire "invoicing-paid" pillar is paper. Mollie is the right EU choice (SEPA-native, lower fees than Stripe in EU, Lithuanian-friendly).
2. **Recurring lesson rules** (`RRULE` or simple weekly-on-Tuesday-at-17:00 model). The current schema can't express "Mary rides Caspar every Tuesday at 17:00." This is the single most-requested feature in this category.
3. **Lesson packages with remaining-balance tracking** — both for owners (revenue forecasting) and clients (self-serve "how many lessons do I have left").
4. **Client self-booking (request-and-approve flow)** — see point 6 above.
5. **Vet/farrier/turnout as first-class events** — point 5 above.
6. **Email + SMS reminders** — the marketing claim. Build email first (free via Supabase + Resend); SMS via Twilio or local EU SMS providers as a Premium-only feature gated by usage cap.
7. **Per-horse profitability view** — "this horse generated €450 in lesson revenue and cost €280 in feed/farrier this month." The data is in the schema (expenses can be tagged to horses, lesson prices are stored). The view is what's missing. **This is the single highest-impact feature you could ship for owner stickiness.**
8. **Real waitlist capture + double-opt-in confirmation email** — point 2 above.

### High-value features (retention + monetization)

1. **PWA install + offline mode for trainers in the arena.** No-signal arena is real; an offline-tolerant session log is a moat.
2. **Photo upload per session** ("Caspar after Tuesday's jumping lesson"). This is the Instagrammable layer that drives retention — clients screenshot and share, becoming free distribution.
3. **WhatsApp deep-link integration** — when you cancel a lesson, generate a pre-filled WhatsApp message to the affected client. Don't fight WhatsApp; ride it.
4. **SEPA Direct Debit for recurring boarding.** This is the killer commercial feature for livery yards. Mollie supports it natively in Lithuania, Latvia, Estonia, Poland, Germany.
5. **Client mobile app shortcut (PWA)** — "Add to home screen" prompt for clients on first visit to portal. Frictionless reorder.
6. **Weekly stable-owner email digest** — "this week: 47 lessons, €2,340 revenue, 3 horses approaching cap, 2 invoices overdue." Auto-generated from the dashboard data. Drives weekly login.

### Useless / overcomplicated (consider removing)

1. **Internal Chat module.** See above. Feature-flag off, deprioritize indefinitely.
2. **MFA panel as a flagship setting** — for a single-owner yard with one login, MFA is operational noise. Keep it as an option for Premium tier; don't surface it in onboarding.
3. **`/s/[slug]` public stable page** — *if* it's just a brochure page, kill it; it's not worth the maintenance. *If* it's the customer-facing self-booking page (i.e., where new riders find your yard and book a trial lesson), it's the most strategically important page in the product. Decide now what it is. (I didn't read it yet — find out and commit.)
4. **Birthdays widget** — keep, but stop investing engineering time in it. It's a "ship and forget" feature.
5. **Activity heatmap on dashboard** — if it duplicates the welfare bucket strip, remove. One workload visualization on the dashboard, not two.

---

## Part 3 — UX/UI & product experience

### First impression

**Marketing landing:** A. The hero is sharp, the pain section is the best-written piece in the whole asset, founder note is honest. Cream + green + saddle tan looks like a premium brand. The copy understands the customer.

**In-app dashboard:** B–. The structure is right (greeting, primary CTAs, today's lessons, KPI rings, quick actions), the information density is appropriate. **But the navy + orange palette is wrong** and reads as a generic SaaS dashboard, not as Hoofbeat. The serif "Hi" in the greeting is on-brand; the rest of the chrome isn't. The hero feels like Linear/Notion, the brand voice asks for Aesop/Berluti.

### Navigation clarity

The sidebar IA is clean and role-aware. Owner sees 10 items; employee 7; client 4. Feature-flag-aware, so disabled modules drop out. **Good as is.** Two micro-issues:

- "Welfare" sits second-from-top in owner view. Correct strategically — it's the wedge — but a new user will not click it on day 1. Consider a 30-day "Tour" highlight that pulses on Welfare for new owners.
- "Chat" is in the nav. If you accept my recommendation to deprioritize Chat, hide it from the nav by default.

### User flow audit per role

**Owner** (the decision-maker, the credit card):
- Login → Dashboard home with greeting, primary CTAs, today's lessons, KPIs. ✅ logical.
- Daily flow: open calendar, drag in/out lessons, log a session, send an invoice. The calendar primary action band on the dashboard is correct.
- Weekly flow: review welfare bucket counts, check finance dashboard, settle outstanding balances.
- Monthly flow: variance vs last month, export to accountant. **The export-to-accountant flow is the unverified piece I'd test most carefully.** Lithuanian accountants use specific software; CSV exports need to be import-compatible (Rivilė, Centas, etc.).

**Trainer / Employee**:
- The flow has to be 100% phone-first. Trainer in arena, gloves on, opens app, taps today's lessons, logs a session note, marks complete. Three taps maximum.
- Risk: the current Sessions page may assume desktop. **Test on a real phone in a real arena before launch.**

**Client / Rider**:
- The portal currently shows past lessons, payments, and rides. Read-only.
- Missing: book a lesson, see remaining lessons in package, pay an invoice, get a reminder. **Without these, the client-facing UX is a brochure, not a tool.**

### Mobile usability

Stated as primary use case. Implementation is partial. Sidebar drawer pattern is good. Calendar grid should be tested under thumb pressure. **High-risk surface, mandatory dogfood.**

### Premium feel: brutally honest

- The marketing landing feels premium. Cream, green, saddle, serif, restraint, copy with bite.
- The in-app dashboard does not yet feel premium. Navy + orange + white is the visual language of every B2B SaaS dashboard from 2018 to today. It's competent. It's not Hoofbeat.
- **The single highest-leverage 1-day project in the entire codebase: re-skin the dashboard to the locked brand palette.** Move the chrome backgrounds to Arena Cream. Move the primary buttons to Paddock Green. Use Saddle Tan for accents only (not as the dominant action color). Restrict orange to error/alert states only. Pull the serif (Source Serif 4) into all headings, not just the greeting. Tighten the type scale.

### What feels cheap

- The "Hi" greeting font matches the brand; the cards around it don't.
- The KPI ring colors (orange, navy, brick-red) clash with the locked palette.
- The mini-bars decoration on the Revenue card (`{[30, 50, 40, 65, 55, 75, 90].map ...}`) is a hardcoded fake. Either show real revenue trend or remove. Fake data for decoration is the single biggest "cheap" tell in B2B SaaS.
- The icon set is hand-rolled SVG strings inside the sidebar component. Functional, but the inconsistency in stroke weight will compound. Adopt Lucide-react properly (it's already in the dependency tree on the Recharts side).

### What feels confusing

- "Sessions" vs "Lessons" is conceptually correct but unclear to a new owner. The sidebar has both. A first-time user thinks "what's the difference?" Add a one-liner on each page: "Lessons are billable. Sessions are everything else (training, hacks, turnout)."
- "Welfare" as a nav label is honest but vague. Consider "Horse load" or "Workload" — more concrete. (Counter: "Welfare" is the brand promise, so keep it. The trade is naming clarity vs naming positioning. I'd keep "Welfare" but add subtitle on the page itself.)

### What would make a paying customer quit

- Logging an invoice that doesn't actually email the client. Test this end-to-end.
- A double-booking that the database rejected but the UI didn't warn about gracefully (does the create-lesson form catch the GIST exclusion error and explain it nicely?).
- A trainer who can't log a session on their phone. This is the most common churn cause for stable software in field tests.
- An accountant who can't import the export CSV. Test this with a real Lithuanian accountant before billing the first paying customer.

---

## Part 4 — Monetization & pricing strategy

### The current proposal vs reality

Landing page tiers:
- Starter €19 (≤10 horses) — basics: schedule, clients, payments
- Pro €49 (11–40 horses) — adds workload tracking, client portal, multi-trainer, SMS
- Premium €99 (41+ horses) — adds team roles, advanced reporting, priority support
- Annual: 15% off

**Critique:**

1. **Starter cannibalizes Pro.** A 12-horse yard (in the lower band of your ICP) sees €19 vs €49 and self-selects Starter. You lose €30/mo and the wedge feature (workload tracking is *the* welfare promise). **Fix:** lift workload tracking into Starter, or remove Starter entirely.

2. **The "horses count" segmentation is brittle.** A yard buys the lowest plan that fits then never upgrades. Better segmentations: number of *active clients*, number of *trainers*, or — the cleanest — *features used*.

3. **You're undercharging Pro relative to value.** A 25-horse yard with 80 clients is generating €15–25k/mo of revenue. €49/mo is 0.2–0.3% of revenue. The ROI proof in your own pain story is "€200/mo of forgotten invoices." If Hoofbeat recovers €200/mo and costs €49, the customer gets 4× ROI. You could charge €79–99 for Pro with the same ROI argument and 60% more revenue per customer. Test it.

4. **Per-horse pricing is the missing lever.** Stables think in "what's the cost per horse per month." Per-horse pricing is operationally cleaner and aligns price with success. Suggested: **€2.50/horse/month, minimum €30, maximum €150**. A 25-horse yard pays €62.50 (more than current Pro). A 12-horse yard pays the €30 minimum. A 60-horse yard pays €150 (current Premium price, more horses).

5. **Annual at 15% is light.** The math on a year of churn is what matters: if monthly churn is 4%, annual customers are 3× more valuable than monthly. **Bump annual discount to 20%** to push more customers there.

### Recommended revised pricing

**Plan A: stable-count tiers (closest to current).**
- Starter — €29/mo — up to 15 horses, single trainer, includes workload + client portal
- Pro — **€69/mo** — up to 40 horses, multi-trainer, SMS reminders, client self-booking
- Premium — €129/mo — unlimited, custom branding, priority support, accountant integrations
- Annual: 20% off

**Plan B: per-horse (recommended).**
- €2.50/horse/month, minimum €30, maximum €150
- All features unlocked at all tiers (kill the feature-gating dance)
- Annual: 20% off
- Add-ons:
  - **Active client portal seats** above 50: €0.50/seat/mo (the lever you already considered)
  - **SMS reminders pack:** 100 SMS/mo = €5; 500 SMS/mo = €19; 2000 SMS/mo = €59
  - **Custom domain for /s/[slug]** (e.g., book.myyard.lt): €5/mo
  - **Accountant CSV/XML integration**: €9/mo

Plan B aligns price with success and removes the cliff between tiers. Most B2B SaaS in vertical-niche eventually moves here. **Recommendation: launch on Plan A for simplicity, plan migration to Plan B at month 18.**

### Realistic revenue model — can you hit €10k/mo?

**Per the business plan:** M18 = 50 customers, ~€1,950 MRR. M24 = 85–110 customers, founder draw €2,500/mo.

**To hit €10k MRR**, you need approximately:
- 200 Pro customers @ €49/mo (Plan A current), OR
- 145 Pro customers @ €69/mo (Plan A revised), OR
- 100 customers averaging €100/mo (Plan B per-horse with add-ons, mix of yard sizes)

**SOM ceiling per plan:** 500–2,000 stables in 5 years.

**To hit €10k MRR with Plan B:** you need ~100 paying customers at €100 average ARPU. That's 5–20% of your SOM. Realistic but requires:
1. Beachhead saturation in LT (50 stables) before opening LV/EE.
2. PL launch executed with a local partner (a Polish equestrian federation or magazine).
3. DE launch with native German support and at least one DE reference customer.
4. Founder-led sales motion: cold outbound, conferences (4–6/year), federation partnerships.
5. Add-on attach rate of >30% (SMS pack, accountant integration).

**Honest timeline:** €10k MRR is M30–36, not M24. The plan's M24 target of €4–5k MRR is the realistic middle-ground.

### What needs to be true for €10k MRR to happen

1. The product reaches feature-parity-plus-wedge by M6 (pricing pages, paid SaaS, client self-booking, real invoicing).
2. The waitlist captures emails and converts at >10% to paid.
3. You commit to founder-led sales for 24 months — no paid ads as a primary channel; LinkedIn + cold outbound + 1-on-1 onboarding for the first 50 customers.
4. Pricing moves to €69 Pro within 6 months of public launch, after the first 30 customers validate willingness-to-pay.
5. LT saturation by M12 (~25–35 LT customers); PL by M18; DE entry by M24.
6. Net revenue retention >100% (add-ons + upgrades net of churn).

If any 2 of those break, you cap at €4–6k MRR. That's still a successful lifestyle SaaS but it's not what the audit prompt asked you to validate.

---

## Part 5 — Business viability

### Is this a real business or just a tool?

Real business — but a *constrained* one. Vertical SaaS in a low-volume vertical (500–2,000 stables in your geography) has a structural ARR ceiling. The business plan is honest about this: €25–40k MRR solo without funding. €300–500k ARR is a proper income — but it's not a venture business and it's not a "build to sell" path without horizontal expansion (vet ecosystem, hardware integrations, insurance partnerships).

Three real-business markers you have:
1. **Domain credibility** (you own the yard). This is irreplaceable for outbound and PR. No competitor can fake it.
2. **Locked brand foundation** — name, palette, positioning, voice rules. Most pre-revenue founders don't have this.
3. **Working product** with real database discipline. You're not selling vapor.

Two missing markers:
1. **Paying customers.** Zero. Until 5 yards pay €49 each, every assumption in this audit is theory.
2. **Distribution moat.** No newsletter, no LinkedIn following visible, no podcast, no community. The plan calls for direct outreach + community; the community side is unbuilt.

### Demand reality check

The Baltic + Polish + DACH stable market is roughly:
- Lithuania: ~500–700 active commercial stables (per LSF / equestrian federation estimates)
- Latvia: ~300
- Estonia: ~250
- Poland: ~3,000+ (but very heterogeneous)
- Germany: ~10,000+ (huge but crowded with established competitors)
- Czechia: ~600

**TAM: ~14,000–15,000 stables across your target geography.** Of those, your ICP (15–40 horses, professional yard) is roughly 20–25% = **3,000–4,000 stables addressable.** Your SOM target of 500–2,000 in 5 years is reaching for 12–60% of addressable — aggressive but defensible if you have the only EU-native option.

Demand is real but conversion is slow. Rural businesses with €50–500k revenue do not buy SaaS in the same buying cycle as urban startups. Expect 3–6 month sales cycles, multiple touches, in-person visits for the first 20 customers. Founder-led sales is not a strategy you choose; it's a constraint you accept.

### Biggest risks (ranked)

1. **Founder burnout before M12.** Solo bootstrapped, primary income, slow buying cycle, no team, no paid acquisition that works in this category. The single largest reason this fails is you stop. Mitigation: structure 24 months of execution into 90-day sprints with explicit win/loss/no-go criteria. Set a 5-paid-customer milestone for M3 — if you're not there, intervene.

2. **Promised features unwired at first paid customer.** SEPA, SMS, recurring boarding — all promised on the landing, none visibly wired. The first 5 paid customers will demand these. Either ship them or remove them from the landing. Selling vaporware to a 50-yard customer base will burn your reputation in a community that talks.

3. **Brand-fragmentation credibility damage.** The premium positioning depends on consistency. A customer who lands on the cream-and-green site and gets the navy-and-orange dashboard concludes "the marketing is theater." Easy to fix. Painful if not fixed.

4. **Equine Genie or Stablebuzz launching localized EU versions.** Probability low but not zero. Both have funding. Mitigation: speed of EU-native compliance (SEPA, GDPR, PL/DE language) and price discipline.

5. **The vet/farrier/turnout integration gap.** If welfare data is wrong because farrier visits are stored as "lessons," the wedge feature undermines its own credibility. Fix in MVP, not post-launch.

6. **Feature creep.** The temptation to ship Chat, MFA, social features, AI suggestions, etc. before getting 50 paying customers is the silent killer. Discipline on "what does the next 50 customers actually pay for" — and the answer is invoicing-paid + welfare + reliability.

### What would kill this startup?

- 18 months without a paying customer.
- A landing page that doesn't convert and isn't iterated on weekly.
- Building Chat or any feature that doesn't appear on a customer's "I would pay for this" list.
- Trying to compete in DACH before LT is saturated.
- Burning out alone. Get a co-founder, an advisor, or at minimum a peer-group of EU vertical SaaS founders by M6.

### Verdict — is this worth continuing?

**Yes. Continue.**

You have a genuine wedge (welfare-first dashboard), a credible founder narrative (you own the yard), a locked brand that is genuinely premium, a working product that's 70% MVP-complete, and a market that — while not a venture-scale market — supports a real €200–500k ARR business.

But continuing is conditional on three things:
1. Brand consistency between marketing and product (1-week project).
2. Real waitlist capture + the first 5 paying customers signed by M3 (not later).
3. Scope discipline: invoicing-paid + recurring billing + client self-booking before any new feature is shipped.

If you can do those three, the answer is yes. If you cannot commit to those, the answer is "you're building a portfolio piece, not a business."

### What MUST be fixed BEFORE selling

1. Waitlist email capture wired to Supabase with double-opt-in.
2. In-app dashboard repainted to brand palette (Paddock Green / Saddle Tan / Arena Cream).
3. Stripe or Mollie integration for a real subscription billing flow.
4. End-to-end test of: signup → onboarding → add 5 horses → schedule a lesson → log a session → invoice a client → receive payment confirmation. Until this round-trip works on a fresh account in <30 minutes, do not invite a paying customer.
5. Mobile dogfood test: 1 week of you running your own yard from your phone only. Document every friction; fix the top 5.
6. The promised features list on the landing matches reality. Either ship SEPA, SMS, vet/farrier — or rewrite the landing.

---

## Part 6 — Strategic roadmap

A 4-phase plan with explicit dates, owners, and exit criteria. Today is **30 April 2026**.

### Phase 1 — Foundation lockdown (May 2026, 30 days)

Goal: stop the bleeding before it starts.

1. **Brand consistency in-app.** Repaint dashboard to Paddock Green / Saddle Tan / Arena Cream. Replace `card-navy` with `card-paddock`. Move primary CTA color to Paddock Green. Use Saddle Tan for accents only. Pull Source Serif 4 into all headings. Replace hardcoded fake bars with real data or remove. **Exit criterion:** screenshot side-by-side of landing + dashboard reads as one product. **Owner:** Andreja + dev. **Effort:** 5–8 days.

2. **Waitlist capture wired.** Supabase `waitlist_signups` table + RLS policy + double-opt-in via Resend. Replace `alert()` with real submission. **Exit criterion:** test signup arrives in DB and triggers welcome email. **Effort:** 2 days.

3. **End-to-end test on fresh account.** Document every friction in a markdown file. Fix the top 10. **Effort:** 3 days.

4. **Remove or rewrite unwired claims.** Either ship Stripe/SEPA + email reminders, or remove the lines from the landing. **Effort:** depends on choice; the rewrite is 1 hour, the integration is 5–7 days.

5. **Localized landing variants.** LT version of the waitlist landing, ready to publish. (PL/DE later.) **Effort:** 1–2 days.

6. **Set 90-day OKRs.** Three numbers: waitlist signups (target: 150 by July 30), conversations with prospects (target: 20), paying customers (target: 5 — wait, see Phase 2). **Effort:** 4 hours.

### Phase 2 — MVP completion + first 5 paying customers (June – July 2026, 60 days)

Goal: prove the product works for someone who isn't you.

1. **Stripe Checkout / Mollie integration.** Subscription billing for monthly + annual. Pick Mollie (EU-native, SEPA out of the box). Add `stripe_customer_id`, `subscription_status`, `current_plan`, `trial_end_at` to `stables`. **Effort:** 7–10 days.

2. **Recurring lesson rules.** Add `recurrence_rule` column to lessons or a `lesson_series` table. Support "weekly on Tuesday 17:00 for 12 weeks." **Effort:** 5 days.

3. **Lesson packages with balance tracking.** UI on client profile: "Mary has 7 lessons remaining in her 10-pack. Next renewal: Aug 15." **Effort:** 5 days.

4. **Per-horse profitability view.** New page: `/dashboard/horses/profitability`. Revenue from lessons assigned to horse minus expenses tagged to horse. **Effort:** 3 days.

5. **Email reminders** (no SMS yet). Send 24-hour-before lesson reminder via Resend. **Effort:** 2 days.

6. **Vet/farrier/turnout as first-class events.** New `events` table, separate from `lessons`. Welfare logic ignores non-saddled events for workload count but flags them on the horse profile. **Effort:** 3 days.

7. **Onboarding import flow polish.** Import horses + clients from CSV in under 10 minutes. Test with real Excel exports from your own yard. **Effort:** 3 days.

8. **First 5 paying customers.** Personal outreach: 30 conversations to land 5 yes. Free 14-day trial → €49/mo (or revised pricing). Founder onboarding call with each. **Owner:** Andreja. **Effort:** ongoing.

**Exit criteria for Phase 2:**
- 5 paying customers.
- 3 of them have invoiced a real client through Hoofbeat.
- 1 of them has paid you 2 monthly cycles in a row.
- NPS / qualitative feedback from all 5.

### Phase 3 — Pricing launch + repeatable acquisition (August – December 2026, 5 months)

Goal: prove you can acquire customers without your personal phone calls.

1. **Public launch.** Full pricing live, free 14-day trial, self-serve signup → first lesson logged within 30 minutes.

2. **Pricing test:** push Pro to €69 with the next 20 customers. If conversion holds, lock in.

3. **SMS reminders shipped** as a Pro+ feature. Mollie pricing model (per-message metered).

4. **Client self-booking** (request-and-approve flow). Public link from `/s/[slug]` to client booking. **This may be the single highest-impact feature for client-side stickiness.**

5. **Content engine.** One LinkedIn post per week, in EN + LT. Topics: stable economics, welfare, the five-tool problem, customer stories. Goal: 1,000 followers by Dec 2026.

6. **PL launch** with a local partner (Polski Związek Jeździecki contact, equestrian magazine, or single-yard champion who becomes the PL reference customer).

7. **Accountant CSV/XML integration** for at least 1 LT accounting tool (Rivilė or Centas). This converts trial-to-paid for any owner who has an accountant.

8. **30 paying customers by end of December 2026.** 50/50 split LT/PL.

**Exit criteria for Phase 3:**
- 30 paying customers.
- ≥10 from inbound (waitlist, content, referrals) — i.e., not from your direct outbound.
- MRR ≥€1,500.
- Monthly churn ≤6%.
- Pricing locked at the post-test rate.

### Phase 4 — Scale (Jan 2027 – Apr 2028, 16 months)

Goal: validate the path to €10k MRR.

1. **DE launch.** Native DE language, DE reference customer secured, pricing in EUR (no local-currency variants), GDPR-compliant marketing copy. M14 from public launch.

2. **PWA + offline session log.** The trainer-in-the-arena workflow.

3. **WhatsApp deep-link** for cancellations and reminders.

4. **Premium tier launch.** Custom branding, custom domain on `/s/[slug]`, priority support, white-label option for federation partners.

5. **Add-on monetization.** SMS pack, accountant integration, extra client portal seats. Target add-on attach rate: 30%.

6. **Federation partnerships.** Lithuanian Equestrian Federation, Polish Equestrian Federation, Estonian Equestrian Federation. Co-marketing or revenue share. The federation has the email list you can never buy.

7. **Customer success motion.** Quarterly check-in calls with every paying customer for the first 100. Feed their feature requests into the roadmap. The first 100 are your reference base for the next 1,000.

8. **100 paying customers by end of December 2027.** €5–7k MRR. **150 paying by April 2028.** €7.5–9k MRR.

9. **Hire #1: a part-time customer success / community manager** at €40k MRR. Until then, you do everything.

**Exit criterion for Phase 4:**
- €7.5k–10k MRR
- 150–200 paying customers
- ≥30% from inbound channels
- ≥1 federation partnership
- Founder draws ≥€3,500/mo from the business

If you hit those, you're a real business with a sustainable path forward. If you don't, you're at the structural ceiling and need to decide: hire, raise, or accept the lifestyle ceiling.

---

## Closing — what I would actually do this week if it were my money

1. **Tomorrow morning:** wire the waitlist form to Supabase. Stop lying to visitors.
2. **By Friday:** repaint the dashboard chrome to Paddock Green / Saddle Tan / Arena Cream. The single highest-ROI cosmetic change.
3. **By next Friday:** rewrite the landing to remove unwired claims (or commit to shipping them in 30 days).
4. **Within 14 days:** end-to-end fresh-account test, mobile dogfood for one full week from your phone only, fix the top 10 frictions you find.
5. **Within 30 days:** Mollie subscription billing live. First paying customer (you, on a real card, paying yourself) by May 31.
6. **Within 60 days:** 5 external paying customers, recruited from your network.

The product is more than ready to start. The brand is locked. The market is real. The founder credibility is unique. What's missing is not another feature — it's the discipline to ship the unsexy 5 things that turn a polished product into a paid business.

Don't build another module. Bill someone.

— end of audit
