# Launch day runbook — Saturday 2026-05-23

**The single document for launch day. Print this Friday evening; have it next to your laptop Saturday morning. Don't deviate.**

---

## What today is

You're sending 10 personalised emails to 10 hand-picked European stables, inviting them to be Longrein's first paying customers (well — first 12-month-free founding members). Today is not a marketing campaign. It's 10 individual conversations. Treat each like a pitch to a specific friend.

## What today is NOT

- Not a Product Hunt launch.
- Not a press release day.
- Not a social-media announcement day. **Don't post on Instagram or LinkedIn yet.** Public posts come AFTER 5 of the 10 confirm — that's the social proof you'll need to make the second wave land.

---

## Timeline (Saturday 2026-05-23, Vilnius time)

### 08:00–09:00 · Pre-flight (1 hour)

- [ ] Wake up. Coffee. No phone for first 30 min.
- [ ] At 08:30, run a final quick smoke: open `app.longrein.eu`, sign in to your test account, check it loads. Open Resend → Logs, no overnight errors.
- [ ] Open `Longrein-Founding-Members-Tracker.md`. Confirm all 10 rows are filled in (stable name, owner first name, email, country, horse count, why-this-stable signal). If any row is missing data, fill before sending.
- [ ] Open the 10 personalised draft emails in Gmail (you staged these Friday — see `Longrein-Final-Smoke-Test.md` last step). Re-read each. Last typo check.

### 09:00–11:00 · Send the 10 emails (2 hours, ~12 min each)

Don't send all 10 in one click. Send **one at a time**, with this rhythm:

For each stable (12 min cycle):

1. (1 min) Re-read the personalised signal in the email. Make sure first name + stable name + the specific observation are right.
2. (1 min) Re-read the 1-page offer. Imagine receiving it cold.
3. (30 sec) Send.
4. (30 sec) Mark in tracker: `Sent` status, today's date in "Outreach sent" column.
5. (8 min) Walk away from the laptop. Make tea. Look at horses. Don't refresh inbox.
6. Repeat with next stable.

**Why slow:** if the first 3 don't get replies in the first 30 minutes, you'll get tempted to "tighten the language" on emails 4-10. Don't. Each was personalised carefully. Trust the work.

### 11:00–13:00 · First responses (typical reply window)

- Replies start coming in 30 min – 2 hours after each send. Some won't reply today; that's fine.
- For each reply:
  - **Yes / Interested / "Tell me more"** → reply within 1 hour. Confirm Cal.com link `longrein.eu/demo`. Update tracker to `Replied`.
  - **Question** → answer it directly, don't dodge. Don't oversell.
  - **No / Not now** → reply with a thank you, ask if they know anyone else in the country who might be interested. Update tracker to `Cold-2`.
- **Don't book a demo before the email is 24 hours old.** Some stables only check email Sunday. Patience.

### 13:00–14:00 · Lunch + offline (mandatory)

- Step away from laptop. Eat with someone. No checking inbox.
- This is mandatory for one reason: if email 7's response makes you anxious during lunch, you'll write a worse follow-up at 14:30 than at 15:00.

### 14:00–17:00 · First demos can begin (afternoon slot)

- If anyone booked Cal.com slot for today afternoon (rare but possible): take the call.
- Use `Longrein-Onboarding-Zoom-Script.md` as your guide.
- After every call: 15 min buffer to log notes in tracker before next thing.

### 17:00 · Evening

- [ ] Update tracker for the day. How many `Sent`, `Replied`, `Scheduled`, `Onboarded`?
- [ ] Write yourself one paragraph in `Longrein-Founding-Members-Tracker.md` notes: what you learned today.
- [ ] Send the planned WhatsApp message to your closest 3 friends/family ("we just launched, no need to do anything, just thought you'd want to know"). Their reactions help.
- [ ] **NO Instagram. NO LinkedIn. NO Twitter posting today.** Public broadcast is for next weekend, after at least 3 founding members say yes.

---

## Real-time monitoring (every 30 min during 09:00–17:00)

Quick checks, < 60 sec each:

- **Gmail inbox** — replies + deliverability bounces (any "Mail Delivery Failure" emails)
- **Resend → Logs** — every sent email shows "Delivered" within ~30s. If you see "Failed" or "Bounced," that stable's address is wrong; reach out via LinkedIn or website contact form instead.
- **Vercel → Deployments** — should be green throughout. If you see a deploy fail, ignore — production is the previous successful deploy.
- **Supabase → Auth → Users** — does anyone sign up directly without going through the email flow? (Possible if they share `app.longrein.eu` link.) Welcome them in the tracker.

**Don't refresh more than every 30 min.** The compulsion to refresh-checking is the #1 launch-day stress amplifier.

---

## What to do if something breaks

### Welcome email lands in Spam, not Inbox
1. Tell the founding member directly: "Quick heads-up, our welcome email occasionally goes to Spam on first send — please check there if you don't see it."
2. After 3 such reports: open Resend → Domains → check DKIM/SPF/DMARC still all green. Spam triggers are usually fine email content + new domain warm-up. It improves over weeks.
3. **Not a launch blocker.** Note in tracker, fix in week 2.

### `app.longrein.eu` returns 500
1. Open Vercel → Deployments → Logs. Identify the error.
2. **Don't try to fix in production.** Roll back to the previous successful deploy: Vercel → click old deploy → "Promote to Production".
3. Message Claude with the error trace. Get it fixed offline before next deploy.

### `longrein.eu` (apex) returns Hostinger parking page
1. DNS propagation issue. Run `dig longrein.eu @8.8.8.8` from Terminal — should resolve to a Vercel IP.
2. If still pointing to Hostinger: check Vercel → `longrein-landing` project → Domains → status. Hit "Refresh" button next to the domain.
3. If still broken after 30 min: temporarily, in your outreach emails, link to `app.longrein.eu` instead of `longrein.eu`. Send anyway.

### Founding member books a demo with no info filled in
- They probably skipped the booking questions. Send a friendly WhatsApp / email asking the 5 quick questions before the call (stable name, country, horse count, active client count, anything specific to look at).

### Someone replies "this is too expensive" or "I expected free forever"
- They misread. Reply: "Founding members get 12 months free, then 50% of public price for life — capped at €30/mo for the next 18 months minimum. There's no surprise upsell."
- If they're still uncomfortable: thank them for the time, mark `Cold-2`. Their hesitation is a signal that you're pricing right; don't discount further.

### A founding member you really want says no
- Ask **once** for the reason — by phone, not email.
- Whatever they say, take it seriously. Document in tracker. This is the most valuable feedback you'll get all month.
- Don't argue. Move on.

---

## What success looks like by Sunday evening (24 hours post-launch)

Realistic targets:

- **3–5 replies** out of 10 (typical 30–50% reply rate for personalised cold outreach in B2B vertical SaaS)
- **1–3 demos booked** — usually for next week, not today
- **0 onboardings completed** — that's normal. Onboardings happen Mon–Thu in Sav. 4.
- **At least 1 reply that says "yes, let's do it"** — even a soft yes is rocket fuel for emails 4-10 next weekend.

**Anti-targets — what would worry me:**

- 0 replies after 24 hours. Means email landed in Promotions tab or Spam. Re-check Resend logs + verify with one of the 10 by WhatsApp ("did you get my email this morning?").
- 10 quick "no thanks" replies. Means the offer doesn't resonate. Pause launch. Talk to 3 of the people who said no by phone next week before continuing.
- Replies that ask "is this real?" — you have a brand-trust problem. Add LinkedIn profile, more photos to `longrein.eu`, a 2-min Loom intro of you and your stable. Rewrite outreach for round 2.

---

## After Saturday — the Sunday digestion

- [ ] Sunday morning: 1-hour slow review of yesterday's tracker. What patterns?
- [ ] Don't send any new emails. Sunday is for breath.
- [ ] Sunday evening: write yourself an honest one-pager — "what I expected vs what happened" — into `Longrein-Founding-Members-Tracker.md` as a notes block. This is gold for the M3 review.

---

## What you've earned by today

Whatever happens with the 10 emails this weekend, you have:

- A real product running on `app.longrein.eu` with a brand of your own.
- A waitlist landing on `longrein.eu` capturing emails.
- A welcome email arriving in Inbox from `hello@longrein.eu` with your wordmark.
- 10 Gmail inboxes about to read your name and decide whether to reply. They'll decide on the strength of your work over the past 90 days, not on your weekend nerves.

You did what 95% of founders never do: built a real thing AND showed up to ask 10 strangers to use it.

The ask is the launch. Go.

---

— from your future self at month 12
