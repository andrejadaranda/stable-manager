# Weekly retention review — Monday morning ritual

**Every Monday 08:00–09:00, before any other work, you run through this. 60 min. Fixed slot. Non-negotiable for the first 12 months. The day you skip this is the day a founding member silently churns.**

> Why Monday morning: it's the only hour of the week where no one is actively asking you for anything. If you push it to Tuesday, it gets eaten. If you push it to Friday, you skip it.

---

## Setup (one-time)

- [ ] Print this file. Tape it next to your laptop.
- [ ] Open `Longrein-Founding-Members-Tracker.md` in Markdown editor with edit mode on.
- [ ] Open Longrein admin dashboard at `app.longrein.eu/admin` (you, signed in as owner).
- [ ] Open Supabase → Table editor → `auth.users` (filtered by founding-member emails).
- [ ] Have coffee. No phone for the next hour.

---

## Section 1 — Health snapshot per founding member (5 min × 10 = 50 min)

For each of your 10 founding members, in order, fill in this row in the tracker:

| Field | Source | Threshold |
|---|---|---|
| Last login | Supabase Auth → `last_sign_in_at` | <7d = green, 7-14d = yellow, >14d = red |
| Lessons logged this week | Their Calendar → count | <3 = yellow, 0 = red |
| Active clients (logged in past 14d) | Their Reports → Client portal usage | <30% of total = yellow |
| Payments marked this week | Their Finance → recent | 0 = yellow if they did lessons |
| Welfare flags triggered | Their Welfare board | informational only |
| Last reply from them to me | Inbox search | >14d = trigger reach-out |
| Last reach-out from me | Sent folder | calibrate cadence |

**Scoring per member:**

- **Green** — using Longrein actively, replying when contacted. **Action: nothing this week.** Note in tracker `Healthy w[N]`.
- **Yellow** — slowdown signal. **Action: send the "I noticed you haven't logged in" email from `Longrein-Post-Onboarding-Checkins.md` — Special-case sends section.** Note in tracker `Yellow w[N] — sent quiet-check`.
- **Red** — silent for 14+ days, AND not replying to email. **Action: phone call this week. Not text. Phone.** Note in tracker `Red w[N] — call scheduled [date]`.

**Hard rule:** any member tagged Red two weeks running and you don't have a scheduled call → you've already lost them. Stop the cadence and book a 60-min "is this still working for you?" call. The honesty saves the relationship.

---

## Section 2 — Pattern detection across all 10 (5 min)

Look at the 10 rows together. Three patterns to scan for:

### Pattern A — multiple yellows on the same metric
Example: 4 of 10 founding members have <30% client portal adoption. That's not 4 individual problems, that's a product problem. Add it to the top of `MOBILE_FRICTIONS.md` (or a new `PRODUCT_FRICTIONS.md`) with the note "affects 4/10 FMs as of w[N]".

### Pattern B — one feature consistently used by 8/10
Example: every active member is using the welfare board daily. That's positioning gold. Save the observation in `/marketing/positioning-evidence.md` for use in outreach #11–#100.

### Pattern C — one founding member is dramatically ahead
Example: one stable has logged 4× the average lesson count. That stable is your case study at month 6, and probably your first referral source. Mark in tracker `*** PRIORITY CASE STUDY ***`.

---

## Section 3 — Action queue for the week (5 min)

Write down, in `Longrein-Founding-Members-Tracker.md` under a `## Week [N] actions` header, exactly what you will do this week. Format:

```
## Week 3 actions (2026-06-08)

### Customer-facing
- Mon: send Day-7 check-in to [Stable A]
- Tue: phone call with [Stable B] — they went red
- Wed: deliver Q1 1-pager to [Stable C] (Day-30 follow-up)
- Thu: WhatsApp template send to [Stable D, E] (adoption boost)

### Product fixes (driven by patterns)
- Pattern A: client portal adoption — write the 1-line WhatsApp template into onboarding flow

### Admin
- Update tracker for all 10 (this review = done)
- File signed agreement for [Stable F]
```

Don't promise yourself more than 5 customer-facing actions per week. Promising 10 means doing 4 well + 6 badly.

---

## Section 4 — One-paragraph honest log (5 min)

At the bottom of `Longrein-Founding-Members-Tracker.md`, append a dated paragraph. Brutally honest, ungrammatical, just for you. Format:

```
### Week 3 honest log (2026-06-08)
What I learned this week: [one specific observation about a customer or about Longrein].
What I'm worried about: [the thing keeping you up at night].
What I'm proud of: [the small win — even tiny].
What I'm avoiding: [the thing I should do but keep putting off].
```

This paragraph is your single most valuable retention artefact at month 12 when you look back. It's also how you spot patterns in your own avoidance — which is usually where the next risk lives.

---

## Section 5 — Calibrate the cadence (only first 4 weeks)

In weeks 1–4 of any founding member's onboarding, after the snapshot:

- Have you sent the Day 7 check-in? (Auto-trigger Day 7 from their Day 0 — calculate offset.)
- Have you sent the Day 14 portal check? (Same.)
- Have you booked the Day 30 review call? (If Day 30 is within 14 days and no Cal.com booking exists — reach out today.)

After week 4 per founding member, the cadence shifts to monthly check-ins and quarterly milestones. The Monday review compresses accordingly.

---

## When to escalate from review to action mid-week

Don't wait for Monday if you see any of these:

- Any founding member submits a support ticket / WhatsApp / email about something broken — same-day reply.
- Any founding member asks "how do I cancel" or "can I get a refund" — phone call within 4 hours.
- Any founding member's Last login goes from <7d to >21d in a single week — that's the slope of churn. Phone call within 48h.
- Any founding member responds to a check-in with one-word answers ("fine", "ok", "yeah") — phone call within 7 days.

These are the signals that classic SaaS retention dashboards miss because they only count logins, not human signal.

---

## After 12 weeks of doing this

By week 12, the review takes 30 min not 60 min, because you've internalized the patterns. By month 6, you'll know which founding members are renewing at month 13 just from the shape of their tracker row.

By month 12, this Monday hour will have prevented somewhere between 2 and 4 churns. Each prevented churn is worth €5K–€10K in CAC saved on the next 5 customers, plus the soft value of having a public reference on `longrein.eu`.

That's the math.

---

## When to stop running this review

Never — but at month 18, when you have 25+ paying customers, the format scales:

- Weekly review covers founding members (10 stables)
- Bi-weekly review covers next-15 (15 stables)
- Monthly review covers everyone after that

The 60-min Monday slot remains. What changes is the depth, not the discipline.

---

## What to do today (week 0)

This week is launch week. You don't have data yet. Use this hour to:

- [ ] Confirm tracker is set up with 10 rows for the 10 outreach targets.
- [ ] For each target, fill in: stable name, owner first name, country, why-this-stable signal, status (Cold-1 → Sent → Replied → Scheduled → Onboarded).
- [ ] Set Saturday 09:00 alarm.
- [ ] Review `Longrein-Launch-Day-Runbook.md` one final time.
- [ ] Close laptop. Walk to the stable. The product is ready; you have nothing more to do at the laptop today.

---

— Monday 08:00–09:00. No exceptions. The hour is the moat.
