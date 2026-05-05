# Longrein — Customer Onboarding SOP (post-FM scaling)

**Klausimas:** Kaip scale'inti onboarding'ą nuo 10 white-glove FMs (45-min Zoom kiekvienam) į 100+ self-serve paying customers be founder bandwidth eksplodavimo?
**Recommendation:** Hybrid model — automated email sequence + in-app guided tour + 15-min „success call" tik high-value customers. Founder time per onboarding nuo 45 min (FM) į 5-10 min (paid).
**Critical insight:** white-glove onboarding'as netinka customer #11+. Taip pat „pure self-serve" netinka B2B SaaS'ui. Hybrid = teisinga balansas.

---

## TL;DR

3 onboarding tier'ai pagal customer profile:

| Tier | Trigger | Founder time | Onboarding type |
|---|---|---|---|
| **High-touch** | Yard >40 horses OR demo'd before signup OR enterprise referral | 30 min Zoom | Founder-led, customized |
| **Standard** | 15-40 horses, self-signed up | 5-10 min email response | Automated + on-demand support |
| **Light-touch** | <15 horses OR free trial only | 0 min direct | Pure self-serve, automated only |

Distribution per Year 1 (post-FM, customer #11+):
- ~20% High-touch
- ~60% Standard
- ~20% Light-touch

Founder time investment per 100 customers onboarded:
- High-touch: 20 × 30 min = 10 hours
- Standard: 60 × 7 min = 7 hours
- Light-touch: 20 × 0 min = 0 hours
- **Total: 17 hours per 100 customers** (vs 75 hours if all high-touch)

This buys back 58 hours/100 customers = ~1.5 hours/customer = sustainable.

---

## Dalis 1 — Trial signup flow (Day 0)

Customer flow:
1. Visit longrein.eu
2. Click „Start 14-day trial" (no credit card)
3. Enter: email + stable name + horse count + country
4. Receive welcome email (automated, instant)
5. Click magic link, set password
6. Land on Longrein dashboard with welcome modal

### Trial signup form fields

```
Required:
- Email (validated, no temp emails)
- Stable name
- Horse count (dropdown: 1-10, 11-25, 26-40, 41-60, 60+)
- Country (LT, LV, EE, PL, DE, AT, CH, Other)

Optional:
- Phone (used only for high-touch tier)
- Number of trainers (used for personalization)
```

Why these fields:
- Email = required for account
- Stable name = used in onboarding personalization
- Horse count = TIER ROUTING (>40 = high-touch, <15 = light-touch, otherwise standard)
- Country = language + GDPR compliance route
- Phone = optional, signals high-intent (more likely to convert)
- Trainers = personalization

### Welcome email (automated, sent within 30 sec)

```
Subject: Welcome to Longrein, [Vardas] — your trial starts now

[Vardas],

Your Longrein trial is active. Here's what to do in the next 30 minutes to make the most of it:

1. Click here to log in: [magic link]
2. Add your first horse (5 min) — start with the one you ride most
3. Add your first client (3 min) — pick a regular
4. Schedule your first lesson (3 min)

That's it. Trial covers 14 days, no credit card needed.

If you get stuck:
- 90-second walkthrough video: [link]
- Quick FAQ: longrein.eu/help
- Direct email: andreja@longrein.eu (yes, the founder)

Tomorrow, I'll check in with one quick question.

Andreja
```

---

## Dalis 2 — Tier routing logic (Day 0+)

Automated routing based on signup data:

### High-touch tier triggers (any of):
- Horse count 41+ (large yard = high LTV)
- Demo'd via Cal.com before signup (warm lead)
- Came via partner referral (federation, vet, accountant)
- Country DE/AT/CH (DACH market priority)

**Action:** within 24 hours, founder receives notification + sends personalized email offering 30-min onboarding call.

### Standard tier triggers (default):
- Horse count 15-40
- Country LT/LV/EE/PL
- No demo before signup
- Self-discovered (web search, organic)

**Action:** automated 7-day email sequence (Dalis 3). No founder direct outreach unless customer reaches out.

### Light-touch tier triggers:
- Horse count <15 (small yard, lower LTV)
- Trial signup but never logs in within 48 hrs (low intent)
- Other country (US/UK/Australia — outside ICP)

**Action:** automated emails only, no founder time. If converts to paid, upgrade to standard tier.

---

## Dalis 3 — Standard tier — 7-day email sequence

Automated via Resend (or Loops.so if migrated).

### Day 1: Welcome (sent at signup, see Dalis 1)

### Day 2: Setup check-in

```
Subject: How's setup going, [Vardas]?

[Vardas],

Quick check — did you get your first horse and lesson into Longrein yesterday?

If yes: great. Today's mini-quest: explore the welfare strip. Click „Welfare" in the sidebar to see how Longrein scores horse workload. (Will be empty until you log a few sessions.)

If no: what's blocking? Reply to this email — I read every one personally.

Andreja
```

### Day 3: Welfare focus

```
Subject: The feature most owners miss in their first week

[Vardas],

Here's a thing about Longrein most stable owners discover by accident:

The welfare workload tracker (top of dashboard) is the most-used feature among our active users. Not the calendar, not invoicing — welfare.

Why? Because it answers the question that matters most: „which horse needs a rest week?"

Try this 2-minute experiment:
1. Log 3-5 sessions you did this week (Sessions tab → +Add)
2. Open Welfare bucket strip on dashboard
3. See how horses sort

Most owners say this is when Longrein „clicks."

Reply if anything's unclear.

Andreja
```

### Day 5: Invoicing trigger

```
Subject: Sunday is invoicing day. We can help.

[Vardas],

If you're like most stable owners, you spend 2-4 hours every Sunday writing invoices.

Longrein's invoicing flow takes 15 minutes. Here's the 90-second walkthrough: [video link]

This Sunday, try sending one real invoice through Longrein. If it works, the next one's easier. If it doesn't, reply and tell me what broke.

Andreja
```

### Day 7: First-week celebration / check-in

```
Subject: One week in — quick check

[Vardas],

You're 7 days into your Longrein trial. Quick stats from your account:
- [X] horses added
- [Y] lessons scheduled
- [Z] sessions logged

If those numbers feel low — what's the friction? Reply and tell me.

If they feel right — you're tracking. 7 more days of trial. Then we talk pricing (€3/horse/mo, no surprises).

Andreja
```

### Day 10: Conversion signals + answer common questions

```
Subject: Common questions in week 2

[Vardas],

Common questions trial users ask in week 2:

Q: What happens after my 14 days?
A: I email you with subscription options (per-horse pricing). You can also extend trial 7 days, no questions, by replying „extend" to this email.

Q: Can I import my client list from Excel?
A: Yes — Settings → Import → CSV. 90-second video: [link]

Q: How does pricing work as my yard grows?
A: €3/horse/mo, capped at €150/mo for stables 50+ horses. So if you grow, you don't get punished.

Q: Can I switch from monthly to annual later?
A: Yes anytime. Annual gives 25% off.

Q: Is my data secure / GDPR-compliant?
A: Yes, EU-hosted in Frankfurt. Full DPA available on request.

Other questions? Reply to this email.

Andreja
```

### Day 13: Trial ending soon — conversion ask

```
Subject: Your trial ends tomorrow — quick decision

[Vardas],

Your 14-day Longrein trial ends [DATE].

You logged [X] horses, [Y] lessons, [Z] sessions. Solid usage pattern.

To continue:
- Annual subscription: [Y horses] × €2.25/horse × 12 = €[total]/yr (saves 25% vs monthly)
- Monthly subscription: [Y horses] × €3.00/horse = €[total]/mo

Activate here: [Stripe Checkout link]

If you need more time, reply „extend" for 7 more days.

If Longrein isn't right for you — also reply, I'd want to know why before you go.

Andreja
```

### Day 14+: Post-trial follow-up

If converted: send paid customer welcome (separate sequence)
If not converted: send graceful exit + ask why
If ignored: 1 final email Day 21 with offer to extend trial

---

## Dalis 4 — High-touch tier — founder-led onboarding

For customers triggering high-touch (per Dalis 2):

### Day 0: Personal outreach within 24 hrs

```
Subject: [Vardas], welcome to Longrein — quick offer

[Vardas],

I'm Andreja, the founder of Longrein. Saw your trial signup with [yard size] horses — that's the size where Longrein really earns its keep.

Quick offer: 30 min Zoom this week, I'll personally walk you through Longrein based on YOUR specific operation. We'll get your horses, clients, and first lessons into the system live.

Two slots this week:
- [Slot 1]
- [Slot 2]

Or pick another time: [Cal.com link]

Andreja
+370 [phone]
```

### Day 1-3: Onboarding call (30 min via Zoom, founder-led)

Same script as FM onboarding (per Founding Members Pack — Dalis 6) but adapted:
- Skip „discovery" phase (we know they're high-value)
- Focus on personalized demo of features matching their stated pain
- End with Stripe Checkout link in chat (capture conversion immediately if they're ready)

### Day 7+: Standard automated sequence + founder check-ins at Day 7, Day 14

High-touch customers get standard email sequence PLUS personal Andreja emails at key moments.

### Conversion target

High-touch tier converts at 40-50% trial-to-paid (vs 18% baseline).

Math:
- 20 high-touch trials × 45% conversion = 9 paid customers
- 20 standard trials × 18% conversion = 4 paid customers (from same effort tier)
- Founder time payoff: 9 vs 4 customers = 2.25× ROI on time investment

---

## Dalis 5 — Light-touch tier — pure automated

For customers in light-touch tier:

- Standard email sequence (Dalis 3)
- NO founder direct outreach
- IF they explicitly reply to founder asking question → upgrade to standard tier
- IF they convert to paid → upgrade to standard tier (now they matter)

Reasoning: founder bandwidth is finite. Light-touch tier is < 15 horse yards (low LTV), or <48hr no-login (low intent). Investing founder time here = poor ROI.

NOT a sign of disrespect — many of these customers will be perfect fit, just don't need hand-holding to get value.

---

## Dalis 6 — In-app guided tour (CRITICAL — automate first 30 min in-app)

Customer logs in for first time → guided tour overlays:

### Step 1: Welcome modal (5 sec)

```
„Welcome to Longrein.

We're going to spend 5 minutes setting up your stable. After that, you'll know enough to use Longrein every day.

Ready?"

[Start tour]    [Skip — I'll explore]
```

### Step 2: Add first horse (90 sec)

Highlight Horses tab, prompt:
„Click +Add Horse. Fill 3 fields: name, breed, age. Don't overthink it — you can add details later."

### Step 3: Add first client (90 sec)

Same pattern with Clients tab.

### Step 4: Schedule first lesson (60 sec)

Calendar tab. „Drag from time slot to create. Or click +Add."

### Step 5: Log first session (60 sec)

Sessions tab. „Sessions are training, hacks, turnouts. Lessons are billable. Log a session you did this week."

### Step 6: View Welfare strip (30 sec)

Dashboard. „This is the welfare workload tracker — most used feature. Will populate as you log sessions."

### Step 7: Check Settings → Stable info (60 sec)

„Update your stable name, currency, time zone. 30 seconds."

### Step 8: Final modal — celebration (10 sec)

„You're set up. Use Longrein for a week, then we'll check in. Any time, support@longrein.eu."

[Done]

### Tour completion target

70%+ of trial users complete tour (industry benchmark for B2B SaaS).
If <50% complete: redesign tour (probably too long).

---

## Dalis 7 — Mid-trial intervention (Day 7-10)

Automated triggers based on usage:

### Healthy users (Day 7+, usage ≥5 actions/day)

No intervention. Standard email sequence continues. Likely converts.

### At-risk users (Day 7+, usage <2 actions/day OR no login 3+ days)

Send intervention email Day 8:

```
Subject: [Vardas], stuck?

[Vardas],

Quick check — Longrein is hard to start using. I get it.

Three common reasons trial users get stuck:

1. Too many horses to add at once → import via CSV ([video link])
2. Don't know which feature matters most → start with welfare ([video link])
3. Want to see real example first → here's a demo account: [link with read-only access]

Reply to this email if any of those resonate. Or just „nope, doing fine."

Andreja
```

### Cold users (Day 10+, no login since signup)

Send recovery email Day 11:

```
Subject: [Vardas], you started a Longrein trial but haven't logged in

[Vardas],

Your trial started [X days] ago and you haven't logged in. No judgment — life happens.

Two paths:

Path 1: Restart your trial (push start date 14 more days). Reply „restart."
Path 2: Cancel and forget about Longrein for now. Reply „cancel."
Path 3: Want help getting started? Reply „help" — I'll set up a 15-min Zoom this week.

Andreja
```

This recovery flow saves ~10-15% of cold trials = real dollars at scale.

---

## Dalis 8 — Conversion mechanics

### Trial-to-paid conversion at Day 14

Customer receives Day 13 email (per Dalis 3) + Day 14 in-app prompt:

```
In-app modal Day 14, on first login:

„Your trial ended yesterday. To continue using Longrein:

[Activate subscription — €X/mo for Y horses]

Or:
[Extend trial 7 more days]

[Cancel and export data]"
```

### Stripe Checkout flow

Customer clicks „Activate":
- Stripe Checkout opens (no Longrein redirect)
- Pre-filled: customer email, plan tier, horse count
- Customer adds payment method
- Confirmed → returns to Longrein with success modal

### Post-conversion welcome

Day 15: paid customer welcome email (different from trial welcome)

```
Subject: Welcome to paid Longrein, [Vardas]

[Vardas],

Your subscription is active. Some practical info:

- Next billing: [date], €[amount]
- Manage subscription: Settings → Billing
- Add-ons available: SMS, accountant integration, custom domain (Settings → Add-ons)
- Founder direct support: andreja@longrein.eu

Now that you're a paying customer, you have full access to:
- All product features
- Direct founder support
- Beta access to new features (we ship regularly)

Quarterly check-in call from me: [Cal.com link]
Annual review: scheduled automatically near anniversary

Happy you're here.

Andreja
```

---

## Dalis 9 — Onboarding KPIs

Track per cohort (monthly):

| Metric | Target | Decision trigger |
|---|---|---|
| Trial signups per month | 15-30 (M6-M12) | <10: marketing/outreach issue |
| Tour completion rate | ≥65% | <50%: redesign tour |
| Day 7 active rate | ≥70% | <50%: onboarding friction |
| Day 14 active rate | ≥60% | <40%: product-market fit issue |
| Trial-to-paid conversion | ≥18% | <12%: pricing or value issue (per pricing strategy doc) |
| Time to first „aha" moment | <3 days | >7 days: product complexity issue |

### Specific intervention thresholds

Per cohort review (monthly):
- If conversion <12% for 2 consecutive months → SURVEY non-converters (5-question email, „why didn't you continue?")
- If tour completion <50% → user testing with 5 customers, identify drop-off points
- If high-touch conversion <30% → review demo script, possibly founder is overselling/underselling

---

## Dalis 10 — Scaling beyond 100 customers (when SOP needs evolution)

Year 2 (M13-M24), customer count >100:
- Founder bandwidth maxes out even with hybrid model
- Need first hire (per DACH playbook + Year-1 financial model)

DE Customer Success Lead (M14 hire) takes over:
- High-touch tier for DE customers (in DE language)
- Standard tier coverage (replies + monitoring)
- Light-touch automation continues unchanged

Founder retains:
- Strategic accounts (>40 horses, partner referrals)
- Quarterly business reviews for top 20 customers
- Add-on activation conversations
- Renewal conversations (high-value customers)

This shifts founder from „doing onboarding" to „managing onboarding strategy + handling exceptions."

---

## Dalis 11 — Common onboarding mistakes (NEdaryti)

1. **Treating all customers same** — wastes founder time on low-LTV, under-serves high-LTV
2. **No clear „aha" moment definition** — onboarding without clear success milestone = customer feels lost
3. **Email-only onboarding** — no in-app guidance = customer doesn't know what to click
4. **Founder doing onboarding manually for ALL customers** — burnout in 6 months
5. **No mid-trial intervention** — cold trials silently die
6. **Onboarding ends at conversion** — actually conversion is just BEGINNING. Continue cadence per FM Customer Success Playbook patterns.
7. **Generic „learn more" CTAs** — specific „add your first horse" CTAs convert 3-5× better
8. **Surfacing all features in tour** — paralysis. Highlight 3-5 critical features, defer rest.

---

*Šis dokumentas live'as. Atnaujinti po pirmų 50 customer'ių (real conversion + tour completion data). Įkelti į Drive `02_Product/customer-success/`.*
