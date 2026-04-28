# Equestrian SaaS — Master Business + Product Execution Plan

**Owner:** Andreja
**Date:** 2026-04-27
**Status:** Pre-MVP, pre-revenue
**North Star:** First paying stable signed within 45 days. €5K MRR within 6 months.

---

## 0. Executive Summary

You are not building "stable management software." That market is crowded, ugly, and commoditized (BarnManager, Equestic, Stable Secretary, EquineGenie). You are building **the activity layer the equestrian world is missing** — the place where every ride, lesson, and horse session gets logged, seen, and shared across the people who care about that horse.

The wedge: **stables pay** (because they need operational control). The growth engine: **riders and owners come for free** (because they want to see their horse). The moat: **once a stable's data lives here, every owner and rider connected to that stable is in your network** — and switching cost is the entire history of every horse on the property.

Position it like this in one sentence:

> **"The operating system for modern stables — and the only place owners, trainers and riders see the full picture of every horse."**

Not Strava. Not a CRM. A category. Lead with that line in every conversation.

---

## 1. Strategic Positioning

### 1.1 Category framing

Three existing categories, all weak:

| Category | Examples | Weakness |
|---|---|---|
| Stable management (B2B) | BarnManager, EquineGenie, Stable Secretary | Built like 2010 accounting software. Trainers hate the UX. No client-facing layer. |
| Rider apps (B2C) | Equilab, Horsemeup | Consumer-only. No stable workflow. Data dies with the rider. |
| Sensor / wearables | Equestic, Seaver | Hardware-led. Niche. Doesn't solve daily ops. |

**Your category:** *Connected stable platform.* You sit in the middle. You are the only product where the stable's operational data and the rider's training history are **the same data**, viewed by different roles.

### 1.2 Target customer (B2B — the payer)

Tight ICP for the first 12 months. Don't broaden until you have 50 paying stables.

- **Size:** 8–35 horses on the property
- **Type:** Riding schools and training stables (not breeding, not racing — different workflows)
- **Geography:** Start in your local market (one country, one language). Expand only after PMF.
- **Persona:** Owner-operator or head trainer, 28–48, runs a smartphone-first business, already uses WhatsApp + Google Calendar + a paper notebook. Frustrated by lost lesson notes and parents asking "did my daughter ride today?"
- **Trigger event:** Hiring a second trainer, taking on more clients than they can mentally track, or a parent demanding visibility.

Anti-ICP (politely refuse these for now): single-trainer hobby barns, breeding farms, racing yards, large institutional facilities (>50 horses). They will eat your roadmap.

### 1.3 Unique Value Proposition

Three sentences, in order of who hears them:

- **For stable owners:** *"Run your stable in 10 minutes a day. Every lesson, every session, every horse — in one app your clients actually use."*
- **For trainers:** *"Log a session in 15 seconds. See who rode what, when, and how it went."*
- **For riders & owners:** *"See every ride, every session, every milestone for your horse. Free."*

### 1.4 Competitive advantage (and how to defend it)

1. **Multi-role data model from day one.** Competitors retrofitted client portals. You're building the network from the start. A single horse record is visible — at different depths — to the stable, the trainer, the rider, and the owner.
2. **Free B2C side.** The stable's clients onboard for free. This is your distribution. Every paying stable brings 20–80 free users into the network.
3. **Speed-of-logging obsession.** Sessions must be loggable in <20 seconds on mobile, one-handed, in a barn aisle, with cold hands. This is the feature competitors can't copy without a rewrite.
4. **Premium feel.** This is the cheapest moat. The category is so visually broken that "looks like a 2026 product" is a differentiator. Hire taste, not features.

---

## 2. Monetization — Refined

You proposed €2–5/month for client premium. **I'd push back.** At that price you need 1,000+ paying riders to clear €3K MRR — and consumer subscriptions in a niche vertical convert at 2–5%, so you'd need 25,000 active free riders to get there. The math is brutal at €2.

**Recommended pricing (revised):**

### Stable plans (B2B — primary revenue, ~85% of MRR for first 18 months)

| Plan | Price | Limits | Target |
|---|---|---|---|
| **Starter** | €39/mo | up to 10 horses, 2 staff seats | small training stables |
| **Pro** | €79/mo | up to 30 horses, 6 staff seats, full dashboards | core ICP |
| **Premium** | €149/mo | unlimited horses, unlimited staff, multi-location, priority support | larger facilities |

Annual: 2 months free (16% discount). Push annual hard — it stabilizes cash flow and kills churn.

**Why not per-horse pricing?** It's the industry default and it's the wrong default. It punishes growth, slows trial-to-paid, and forces you into accounting conversations. Flat tiers with horse caps are simpler to sell.

### Client plans (B2C — growth + expansion, ~15% of MRR)

| Plan | Price | Includes |
|---|---|---|
| **Free** | €0 | View own lessons, schedule, horse basic info, session feed |
| **Premium** | €6.99/mo or €49/yr | Full training history, personal journal, goals, progress stats, photo storage, export, multi-horse following |

**Frame premium as "your training diary," not "the paywalled features."** It's the rider's personal product, not the stable's. This matters for positioning and for not pissing off stable owners who don't want their software to nickel-and-dime their clients.

### Unit economics (target by month 12)

- 80 paying stables × avg €65 ARPU = €5,200 MRR from B2B
- 6,000 free riders, 4% paid conversion = 240 × €5 effective ARPU = €1,200 MRR from B2C
- **Total: ~€6.4K MRR / ~€77K ARR**
- CAC target: <€150 per stable (founder-led sales, no paid acq for first 6 months)
- Gross margin: >85% (Supabase + Vercel; main cost is your time)

### What I'd add later (not MVP)

- **Stable add-ons:** SMS reminders (€19/mo), branded client app (€49/mo), payments/invoicing (% of GMV). These are how you double ARPU at year 2.
- **Marketplace take rate:** If you ever facilitate lesson bookings between riders and stables, 5–10% take.

---

## 3. MVP — Strict Scope (45 Days to First Paying Stable)

**Rule:** if it's not on this list, it's not in MVP. Write this on your wall.

### 3.1 In-scope modules

1. **Auth & multi-tenancy.** Email magic link. Roles: `stable_owner`, `trainer`, `client`, `horse_owner`. Single org per user for MVP.
2. **Horses.** Profile (name, breed, age, photo, owner, status), health log (free-text entries with date), notes.
3. **Sessions** (the core). Who rode, which horse, type (flat/jumping/lunging/groundwork/hack/other), duration, optional notes, optional rating (1–5). One-screen mobile entry.
4. **Clients.** Stable invites client by email. Client signs up free, sees their own data only.
5. **Calendar / lessons.** Create a lesson (date, time, trainer, client, horse). Week view. Client sees their lessons.
6. **Dashboards (basic).** Stable: this week's sessions, lessons today, horse activity heatmap (which horses got worked, which didn't). Client: my upcoming lessons, my recent sessions.
7. **Billing.** Stripe subscription, 14-day trial, no credit card required to start.

### 3.2 Explicitly NOT in MVP

These are real features but they kill your timeline. Ship without them.

- Horse owner role (defer to V2 — for MVP, owner = client with full read access to their horse)
- Health/vet records beyond free-text logs
- Feeding / boarding management
- Invoicing / payments to riders
- Mobile native app (PWA only)
- Rider premium tier (free for everyone for first 90 days — convert later)
- Multi-language (one language at launch)
- Photo galleries (single photo per horse OK; no albums)
- Push notifications (email only)
- Reports / exports
- Equipment, tack, farrier, competitions
- Social feed / following / likes

### 3.3 The one feature you must over-invest in

**Session logging speed.** This is the wedge. A trainer must be able to log 15 sessions in 5 minutes from their phone. Pre-fill everything: last rider, last horse, last duration. One-tap repeat. Offline-first if possible (local cache, sync when online).

If session logging takes more than 20 seconds, the product fails. Test this on real trainers before launch.

---

## 4. V2 (Months 4–6) and V3 (Months 7–12) Roadmap

### V2 — "Make the data useful"

- **Horse owner role** (separate from client; full read-only access to their horse's full history)
- **Trainer insights:** workload per horse, rest day suggestions, overtraining flags
- **Client app polish:** progress charts, streaks, monthly recap email
- **Premium tier launch** for riders (€6.99/mo)
- **Stripe metered add-ons:** SMS reminders, extra storage
- **Granular permissions** (which trainers see which horses)
- **Health log structured fields:** vet visits, vaccinations, farrier, injuries — with reminders

### V3 — "Network effects"

- **GPS / arena tracking** (mobile only — no hardware; just phone GPS during a session)
- **Cross-stable rider profile** — a rider can carry their training history when they switch stables
- **Public horse pages** (opt-in) — useful for sales, showcases, breeding
- **Social layer:** follow a horse, follow a rider, milestone reactions
- **Marketplace:** lesson booking between independent riders and partner stables
- **Native mobile apps** (only after PWA proves usage)
- **API + Zapier** for power users

---

## 5. System Architecture

### 5.1 Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui
- **Backend:** Supabase (Postgres, Auth, Row Level Security, Storage, Edge Functions for webhooks)
- **Hosting:** Vercel (frontend), Supabase Cloud (DB)
- **Payments:** Stripe (subscriptions + customer portal)
- **Email:** Resend (transactional)
- **Analytics:** PostHog (product) + Plausible (web)
- **Error tracking:** Sentry

Don't deviate. Don't add a queue. Don't add Redis. Don't pre-optimize.

### 5.2 Data model (MVP)

Plain English first, then schema.

A **stable** is a tenant. Every row in every domain table carries `stable_id`. Users belong to stables via a **memberships** table that defines their role. A **horse** belongs to a stable, optionally linked to a `horse_owner_user`. A **session** is the atomic record: who rode, which horse, when, type, duration, notes. A **lesson** is a scheduled future session: who, what, when, with whom.

```
stables                  (tenant)
  id, name, slug, country, plan, stripe_customer_id, created_at

profiles                 (1:1 with auth.users)
  id (uuid, fk auth.users), full_name, avatar_url, phone

memberships              (user ↔ stable, with role)
  id, user_id, stable_id, role ('owner','trainer','client','horse_owner'),
  status ('active','invited','removed'), created_at

horses
  id, stable_id, name, breed, date_of_birth, sex, color,
  photo_url, owner_user_id (nullable), status ('active','retired','sold'),
  notes, created_at

horse_health_logs
  id, horse_id, stable_id, entry_date, type ('vet','farrier','injury','note'),
  body, created_by

sessions                 (THE CORE TABLE)
  id, stable_id, horse_id, rider_user_id (nullable — can log without account),
  rider_name_freeform, trainer_user_id, started_at, duration_minutes,
  type ('flat','jumping','lunging','groundwork','hack','other'),
  notes, rating (smallint, nullable), created_by, created_at

lessons                  (scheduled future events)
  id, stable_id, starts_at, duration_minutes, trainer_user_id,
  client_user_id, horse_id (nullable), status ('scheduled','done','cancelled'),
  notes, session_id (fk after lesson is "completed" → creates a session)

invites
  id, stable_id, email, role, token, expires_at, accepted_at

subscriptions
  id, stable_id, stripe_subscription_id, plan, status, current_period_end
```

Indexes that matter: `sessions(stable_id, started_at desc)`, `sessions(horse_id, started_at desc)`, `lessons(stable_id, starts_at)`, `memberships(user_id)`.

### 5.3 Roles

- **stable_owner** — full read/write on the stable's data, billing, member management
- **trainer** — read/write sessions, lessons, horse logs; read clients & horses; no billing
- **client** (rider) — read own lessons & sessions; read basic info on horses they ride
- **horse_owner** (V2; in MVP folded into client) — full read on their horse's history

### 5.4 Multi-tenancy via RLS (critical)

Every domain table gets these policies:

```sql
-- Read: user must be an active member of the stable
create policy "stable_members_can_read"
on horses for select
using (
  exists (
    select 1 from memberships m
    where m.stable_id = horses.stable_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

-- Write: only owner or trainer
create policy "trainers_can_write"
on sessions for insert
with check (
  exists (
    select 1 from memberships m
    where m.stable_id = sessions.stable_id
      and m.user_id = auth.uid()
      and m.role in ('owner','trainer')
      and m.status = 'active'
  )
);

-- Client read scope: only their own sessions
create policy "client_reads_own_sessions"
on sessions for select
using (
  rider_user_id = auth.uid()
  or exists (
    select 1 from memberships m
    where m.stable_id = sessions.stable_id
      and m.user_id = auth.uid()
      and m.role in ('owner','trainer')
      and m.status = 'active'
  )
);
```

Test RLS with two test stables and a rogue user before you ship anything.

### 5.5 Things to NOT build yourself

- Don't build auth — Supabase Auth.
- Don't build a billing portal — Stripe Customer Portal.
- Don't build email templates from scratch — Resend + React Email.
- Don't build a UI component library — shadcn/ui.

---

## 6. UX Structure

### 6.1 The four screens that matter

1. **Trainer's "log a session" screen.** Phone-first. Three taps to log: horse → type → duration. Notes optional. Submit. Land back on a feed of today's sessions.
2. **Horse profile.** The most-visited page. Top: name, photo, last session ("Worked 2 days ago — 45min flat by Anna"). Tabs: Activity, Health, Notes. Activity is a vertical timeline. Open a session, see detail.
3. **Stable dashboard.** A "mission control" view. Three blocks: today's lessons, this week's session count per horse (the heatmap — instantly shows under-worked or over-worked horses), recent activity feed.
4. **Client home.** Hero: next lesson. Below: "Your recent sessions" feed. Tap a session, see horse, trainer, notes. That's it.

### 6.2 Design principles

- **Mobile is primary.** Build mobile-first; desktop is the second target.
- **Speed > features.** No skeleton loaders if you can avoid them. Optimistic UI everywhere.
- **No empty empty-states.** When a stable signs up, seed 2 demo horses and 3 demo sessions so they can play immediately. Let them delete the demo data later.
- **One primary action per screen.** Color hierarchy enforces this.
- **Respect the trainer's hands.** Big touch targets. Dark mode for evening logging. No tiny secondary actions in modals.
- **Premium feel = restraint.** White space. One accent color. One typeface. Real photos of horses (not stock illustrations).

### 6.3 Onboarding (the make-or-break flow)

Stable signs up → 14-day trial starts (no card) → guided setup:

1. Stable name + city (10 sec)
2. "Add your first 3 horses" — minimal fields, with a *Skip* button (1 min)
3. "Invite your first trainer or client" — email field, optional skip (30 sec)
4. "Log your first session" — pre-filled with horse #1, just tap submit (15 sec)
5. Land on dashboard with seeded data

Total: under 3 minutes from sign-up to a populated dashboard. Track this metric.

---

## 7. Execution Plan — Week-by-Week

Today is **2026-04-27 (Monday)**. Below is anchored to that.

### Week 1–2 (Apr 27 – May 10): Foundation

**Build:**
- Repo, Next.js 15 + Tailwind + shadcn/ui scaffold
- Supabase project, schema migration v1, RLS policies for `stables`, `memberships`, `horses`, `sessions`
- Auth flow (magic link, sign-up creates a stable, owner role auto-assigned)
- Horses CRUD (list, create, edit, archive)
- Sessions CRUD (list per horse, create, edit) — desktop + mobile
- Deploy to Vercel with a real domain

**Test:**
- Create two test stables. Confirm Stable A cannot see Stable B's horses. RLS test.
- Create a horse, log 5 sessions, view them in the horse profile.

**Launch:**
- Nothing public yet. Internal alpha only.

### Week 3–4 (May 11 – May 24): Make it sellable

**Build:**
- Lessons / calendar (week view, create lesson, mark complete → creates a session)
- Client invitation flow (stable invites by email → client signs up → membership created with `client` role)
- Client home screen (upcoming lessons + recent own sessions)
- Stable dashboard with horse activity heatmap
- Stripe integration: trial, plans, checkout, customer portal, webhook to update `subscriptions` table
- Onboarding flow with seeded demo data
- Email: invitation, trial-ending, payment-failed (Resend + React Email)

**Test:**
- Recruit 2 friendly trainers. Watch them try to log a session on their phone in the barn. Time it. If it's >25s, fix it.
- Run a full trial-to-paid flow with a real card.

**Launch:**
- Closed beta with 3–5 friendly stables. Free for 30 days. Daily check-ins with each.

### Week 5–6 (May 25 – Jun 7): First paying customer

**Build:**
- Health log (simple free-text entries on horse profile)
- Polish: empty states, error states, loading states
- Mobile PWA install prompt
- Landing page (one page: hero, three screenshots, three testimonials slot, pricing, sign-up CTA)
- Help center stub (5 articles: getting started, invite clients, log session, billing, cancel)
- Analytics: PostHog events on every meaningful action

**Test:**
- Push beta stables off "free month" — convert to paid trial. **First conversion attempt.**
- Watch every onboarding via PostHog session replay.

**Launch:**
- Public landing page live.
- Direct outreach to 30 stables (see GTM).
- Goal by end of Week 6: **3 paying stables.**

### Weeks 7–8 (Jun 8 – Jun 21): First real revenue

- Fix whatever the first 3 paying stables complain about
- Reach 10 paying stables
- Start producing content (see GTM)

---

## 8. Go-to-Market — How to Get the First 5 Paying Stables

### 8.1 Founder-led sales (months 0–3)

**No paid acquisition. No ads. No SEO play yet.** You don't have product-market fit, and paid channels burn cash before you've earned the right to use them.

The first 5 customers come from **direct human outreach** by you, the founder. This is not optional. This is how every B2B SaaS gets started.

### 8.2 The 30-stable list

Build a spreadsheet of 30 stables in your local market that match the ICP. For each:

- Stable name, location, # horses (estimated from their website or Instagram)
- Owner / head trainer name
- Instagram handle (this is where they live)
- Email (often hidden; DM is more effective)
- Best signal of "trigger event" — recent hires, new clients, complaining about admin in a post

### 8.3 The first message

Don't pitch. Ask.

> "Hey [name] — I'm building a tool to help small stables track sessions and lessons, and stop losing client info to WhatsApp. You run [stable name] and I'd love 15 minutes of your time to show what we're building and ask whether it would actually help. I'll buy the coffee. No pitch."

Send via Instagram DM. Response rate from this message in the equestrian space is roughly 25–40%, far higher than email, because the equestrian world runs on Instagram.

### 8.4 The meeting

Visit the stable in person if at all possible. This is the highest-leverage hour you will spend this year. You'll learn:

- How they actually run their day (you will be surprised)
- What software they use (probably WhatsApp, Google Calendar, paper)
- What they'd pay to fix
- Whether your wedge is the right wedge

End every meeting with one of two asks:

- **If they're warm:** "I'd like to put your stable on free for 30 days and stay close. If it helps, you stay on at €X. If not, no hard feelings. Can we set this up now on your phone?"
- **If they're skeptical:** "Would you be willing to look at a 5-minute demo when I have it ready in 2 weeks?"

### 8.5 First-customer offer (founding stables)

For the first 10 stables only:

- 50% off for life (€39 → €19/mo Starter, €79 → €39/mo Pro)
- Direct WhatsApp line to you
- Founding stable badge in product
- Early access to all V2 features

This is cheap. They get a deal; you get social proof, testimonials, and a feedback loop.

### 8.6 Channels that scale (months 3+)

In priority order:

1. **Referral.** Every paying stable refers 1.2 stables on average if asked. Build a referral flow at month 3 (give a month free, get a month free).
2. **Instagram content.** Post short videos of trainers using the product in their barns. The equestrian Instagram audience is enormous, engaged, and aspirational.
3. **Trainer influencers.** Find 5 mid-tier trainers (10K–100K IG followers) and give them the product free in exchange for a feature post. Budget €0–€500/post.
4. **Trade shows / regional events.** Equestrian fairs, regional federations. Show up with a tablet, demo on the spot.
5. **Content / SEO.** Blog posts targeting "how to manage a riding school," "best stable management software." This is a 12-month bet, not a quick win.
6. **Paid ads.** Only after €10K MRR. Meta ads to lookalikes of converted customers.

### 8.7 Metrics to watch from day one

- **Activation rate:** % of trial stables that log ≥10 sessions in first 7 days. Target: >60%.
- **Trial-to-paid:** target >25% (small B2B SaaS norm)
- **Time-to-first-session:** target <5 min from sign-up
- **Weekly active stables:** of paying stables, % that log a session in the last 7 days. If this drops below 90%, churn is imminent.
- **Net Revenue Retention:** target >100% by month 12 (driven by add-ons and rider premium upsell)

---

## 9. Risks & How to Kill Them Early

| Risk | How you'll know | Mitigation |
|---|---|---|
| Trainers won't log sessions consistently | Activation rate <40% in week 1 | Aggressively reduce friction; consider prompt notifications; talk to 5 trainers and watch them |
| Clients don't see value | <30% of invited clients log in within 7 days | Lean harder into the "see your horse" angle; add weekly digest email |
| Stables churn after 3 months | Cohort retention drops below 80% at month 3 | Focus on workflows that become indispensable: lesson scheduling, owner reporting |
| Competitor copies you | They will eventually | Speed of execution + brand love is the only moat. Build the network. |
| You over-build | Roadmap explodes; revenue stays flat | Re-read this document monthly. If a feature isn't on the roadmap, it doesn't exist. |
| Pricing too low | <€60 ARPU at 50 customers | Test €99 Pro plan in month 6 with new signups |

---

## 10. What To Do This Week (Concrete)

This is the "close the doc and start working" list.

1. **Today:** decide a brand name and buy the .com (or your country TLD). I'd suggest something short, ownable, and not horse-pun-heavy. Brand work is a parallel track — keep moving.
2. **Today:** create the Supabase project, the GitHub repo, and the Vercel project. Connect them.
3. **Tomorrow:** ship the schema migration v1 with RLS, deployed to Supabase.
4. **By Friday:** auth + horses CRUD live on a real domain.
5. **By Friday:** build the 30-stable target list. Start sending DMs Saturday morning. The product is not ready yet, but the conversations are.
6. **Next Monday:** sessions module live. Show it to one trainer. Watch them log. Iterate.

The fastest way to a paying customer is conversations + a sharp wedge. You have the wedge. Now you need the conversations and the build cadence to back it up.

---

## Appendix A — Things I'd Cut From Your Brief

You asked me to challenge weak ideas. Here are three:

1. **€2–5/month rider premium.** Too low. Either €6.99/mo or annual-only at €49. The price needs to defend the perceived value of "your training diary" or you'll be in a race to the bottom.
2. **GPS in V3 only.** The Strava analogy you reached for is *exactly* GPS. If you want the social/network angle, GPS-on-phone (no hardware) belongs at the top of V2, not V3. It's also a great free-tier hook for riders.
3. **"Strava + CRM + Horse Management."** Internally fine; externally it's three category labels stitched together and confusing. Externally use one line: *"The operating system for modern stables."* Save the Strava reference for late-stage investor decks.

## Appendix B — What Success Looks Like

- **Day 45:** 1 paying stable, 5 active beta stables, 50 free riders, sessions being logged daily.
- **Month 6:** 25 paying stables, €1.5K MRR, 1,500 free riders, first rider premium subscriber.
- **Month 12:** 80 paying stables, €6K+ MRR, 6,000 free riders, you're hiring your first engineer.
- **Month 24:** 300 paying stables, €30K MRR, two markets, native mobile apps shipping.

That's a real business. Build toward it.
