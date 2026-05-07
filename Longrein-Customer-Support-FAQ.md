# Customer support — first 30 days FAQ

**Pre-written answers for the questions Andreja will get from each founding member during their first month. Open this file as a quick-reply reference. Don't link customers to it — it's your cheat sheet.**

> Voice rule on every reply: warm, direct, under 100 words. End every reply with a question or a next step. Never just "yes."

---

## Setup & onboarding (week 1)

### "How do I import my horses from Excel?"
> Settings → Backup & Import → CSV upload. The expected columns are listed there. Or send me the Excel today, I'll convert it overnight and email you back the import-ready file. What's faster for you?

### "Can I bulk-add my clients?"
> Yes — same place, Settings → Backup & Import → Clients tab → CSV. Same offer: send me your spreadsheet and I'll convert it. Faster than wrestling with column names.

### "How do I add my employee/trainer?"
> Settings → Team → Invite → enter their email + role (Employee). They get an email to set their password. Two minutes.

### "What if I want to give my accountant access?"
> Right now we don't have an accountant role separately — they'd come in as Employee. The accountant CSV/XML export feature is on the Q3'26 roadmap. In the meantime, Settings → Backup → CSV export gives you everything they need.

### "Where do I set my horse's weekly limit?"
> Open the horse profile → Edit → "Weekly limit" field. Default is 8 lessons/week, you can lower for older or recovering horses. The Welfare board uses this to flag over-use.

### "Why is my client not seeing the portal?"
> Two possible reasons:
> 1. They haven't accepted their invite — check Settings → Team → resend invite
> 2. Their email on the client record doesn't match the email they signed up with — open client → Edit → fix email
> If neither — message me, I'll check Supabase Auth.

---

## Daily use questions (weeks 1–2)

### "Why can't I book a lesson at this time?"
> Database-level guarantee: a horse or trainer can't be in two lessons at once. The slot must conflict with something. Click an empty slot near the time you want; Longrein will tell you exactly which lesson is blocking. Move that one first.

### "Can I have recurring lessons (every Tuesday at 17:00)?"
> Yes — the Calendar's "+ Recurring lesson" creates a weekly series. Pick start date, end date (or 12 weeks default), and the horse + client + time. Each lesson lands in its own row so you can edit individual ones if needed.

### "How do I mark a lesson as paid?"
> Click the lesson card → "Mark paid" → pick method (Cash/Card/Transfer/Other) → save. Status badge turns green. Or for outstanding: Settings → Boarding → Outstanding board → click the row.

### "My client paid me cash — does this go anywhere?"
> Yes — Mark paid (Cash) records it as a Payment row. Shows in Finance dashboard, in the client's account summary, and in your monthly export. No bank integration yet; everything is recorded by you for now.

### "Can I print this week's schedule?"
> Calendar → ⋯ menu → Print. Opens a clean print view with each day's lessons in a grid. Tape it to the tack room wall.

### "I drag-rescheduled a lesson and it broke — what happened?"
> If you got a red error: you tried to drop on a slot that conflicts with another lesson. Try a different time. If you got nothing — refresh the page; sometimes the optimistic UI lags a server save.

---

## Welfare module (the wedge)

### "What does 'Over cap' mean exactly?"
> Your horse hit or exceeded its weekly lesson limit. New bookings for that horse are blocked unless you override with a reason ("vet has cleared," "rescheduling from cancellation," etc.). The override is logged in the audit log so you can review later.

### "How do I override the cap?"
> When you create a lesson against an over-cap horse, the form asks for a reason. Type one short sentence — that's enough. The lesson saves. You can review override history in the audit log.

### "Why is this horse in 'Resting'?"
> No lessons in 7+ days. Could be planned (winter rest, recovery, owner vacation) or unintended. The bucket flags it so you don't forget the horse exists. Click → see last ride date.

### "Can I change the welfare rules?"
> The bucket thresholds (over cap = 100% of weekly limit; near cap = 85%; resting = 7 days no lesson) are hardcoded for now. The weekly limit per horse you control individually. Per-stable thresholds are on the roadmap once we have feedback from 5+ founding members.

---

## Money & boarding

### "How do I bulk-generate boarding charges for the month?"
> Settings → Boarding → Bulk generate → pick the month → click. One charge per horse with a fee + owner set. Skips horses already charged for that month, so re-running is safe.

### "A boarder paid me partially — can I record that?"
> Right now charges are paid-or-not, not partial. If they paid partial, mark the charge as paid (your call which method) and add a Note saying the partial amount. Better partial-payment support is on the roadmap.

### "Why can't I see profitability for one specific horse?"
> Per-horse profitability requires lessons + expenses tagged to that horse. Open the horse profile → Expenses tab → make sure expenses there have horse-tag set, not just a date.

### "What's the difference between 'Misc charge' and 'Lesson fee'?"
> Lesson fee = price of the lesson, recorded automatically when you create the lesson. Misc charge = anything else you bill the client for (farrier service, tack repair, equipment, late-cancellation fee). Open client → Charges → +Add.

---

## Client portal

### "Will my clients see the prices?"
> They see the price of their own lessons (so they can verify what they're paying), and their boarding charges if applicable. They don't see other clients' prices, owner-only finance dashboards, or your expenses.

### "Can a client cancel a lesson themselves?"
> Not yet. They can see the schedule, but cancellation goes through you (or WhatsApp). Self-cancellation with optional auto-refund logic is on the Q3'26 roadmap.

### "My client said they didn't get the welcome email"
> Three things to try (in order):
> 1. Check their Spam folder — first email from a new sender often lands there.
> 2. Settings → Team → resend their invite.
> 3. Make sure the email on their client record exactly matches what they expect to use.
> If still nothing — message me, I'll check Supabase logs.

---

## Edge cases / breaking points

### "My internet died mid-lesson and now everything looks broken"
> Refresh the page. Longrein is built for online-only, no offline buffer (yet). Your data is safe in Supabase; the broken-looking UI is just the cached state. PWA + offline mode is on the M14 roadmap.

### "I want to delete a lesson — but it has a payment attached"
> The lesson can be cancelled (status → Cancelled), but it stays in the audit log as a deletion-via-cancel. Payments don't auto-refund — you handle the actual refund off-platform. The lesson row is preserved for your records.

### "Two of my employees double-booked a horse — but Longrein didn't stop them?"
> Should not happen. Database GIST exclusion constraints make horse + trainer double-booking physically impossible. If you actually saw this, **send me the screenshot + lesson IDs immediately**. This would be a P0 bug.

### "Can I export everything?"
> Yes — Settings → Backup → CSV export. Includes horses, clients, lessons (with payments), expenses, charges, sessions. CSV per table. Keep your own copy monthly.

---

## Feature requests / roadmap

### "Can you add SMS reminders?"
> Yes, on the roadmap for Q3'26. We'll launch as a paid add-on (~€9/mo, 100 SMS included) once we have 5+ founding members confirming demand.

### "Can you add Stripe / Mollie / SEPA payments?"
> Q4'26. Founding members are free for 12 months so payments don't apply to you yet. When public pricing launches, you'll have Stripe checkout for self-pay clients on Pro+ plans.

### "Can you add [feature X]?"
> Tell me more — what specifically would solve, in your day, that's hard right now? I take 10 founding-member feature requests per cycle. If 3+ of you ask for the same thing, it ships within 90 days. Single requests go on the long list.

### "When are translations coming?"
> Lithuanian Q3'26, Polish Q4'26, German 2027. Right now everything is in English; for LT customers I personally help on Zoom in Lithuanian.

---

## Trust / commercial

### "What if you go bust?"
> Your data is exportable as CSV any time. Worst case: download monthly, you can import into another tool. The data is yours legally and physically.

### "What about GDPR?"
> Privacy Policy at longrein.eu/legal/privacy. Single controller (me, Andreja Adaranda), processors (Supabase EU-Ireland, Vercel EU-Frankfurt, Resend EU-Ireland), no third-party tracking, no advertising cookies. If your accountant wants the DPA in writing, message me — I'll send the standard EU one signed.

### "What happens at month 13?"
> 50% of public price for the lifetime of your account. Currently means €30/mo for stables with up to ~25 horses. Locked in your founding-member contract. No surprise upsell, no auto-renewal trap.

### "Can I tell other yards about Longrein?"
> Please do — you're contractually expected to refer 2 stables in your country in the first 6 months. Send me the warm intro by email, I take it from there. Refer beyond that, and from M6 onwards you'll earn referral credits (capped at 6 months free for 3+ referrals — details when we get there).

---

## Conversations you should escalate to a phone call

If you find yourself typing more than 200 words to a customer reply, **stop, copy what you wrote into a note, and pick up the phone**. These usually need a call:

- "I'm thinking of switching from Longrein"
- "My accountant says this isn't compliant with [LT/PL law]"
- "Three things broke today and I'm losing trust"
- "Can we talk about [feature X] — I have ideas"
- Anything emotional ("frustrated," "disappointed," "doubts")
- Anything about pricing they're uncomfortable with

A 20-min call at month 2 saves a churn at month 4. Always.

---

## Conversations you should NOT engage with

- "Can I get this for free for my friends/family?" → Politely no. Founding members 1–10 only.
- "Can you white-label for my federation?" → Not yet. M14+ feature, paid tier.
- "I have a competing product — can we partner?" → Polite acknowledgement, no commitment. Founding-member period is not the time for biz dev.
- "Add my logo to your website" → Not yet — first 5 case studies are in 2027 once you've used the product 6+ months.

---

## Daily-use shortcuts (memorize these)

| Action | Shortcut |
|---|---|
| Open command palette | `Cmd + K` |
| New lesson | from Calendar, click empty slot |
| Mark current lesson paid | Click lesson → Mark paid |
| Add expense | Sidebar → Expenses → +Add |
| Switch stable | Settings → Account (if multiple — defer to M3+) |

Print this page. Tape it next to your laptop. After 4 weeks, you won't need it.
