# Crisis communications templates

**Pre-written messages for the 9 crises you'll have in your first 12 months. Open this file the moment something breaks. Pick the closest template, swap in the specifics, send. Don't compose under stress — composition under stress is how trust dies.**

> Voice rule under crisis: even more direct than usual. No "we apologize for any inconvenience." No "rest assured." Specific facts, specific actions, specific times. Trust comes from naming what went wrong before they have to ask.

---

## Crisis #1 — Production is down (`app.longrein.eu` returns 500)

### Within 5 minutes — to all founding members via email

**Subject:** Longrein is down — investigating now

> Longrein is currently returning errors for some users. I noticed at [time]. Investigating now.
>
> What this means for you right now: don't try to log lessons or take payments through Longrein in the next 30 min. Your existing data is safe — this is a server issue, not a data issue.
>
> Next update from me by [time + 30 min], no matter what.
>
> — Andreja

### Within 30 min — follow-up either way

**If fixed:**

> Longrein is back up. The issue was [one-sentence cause]. Total downtime: [N] minutes. Your data is intact. Please reload your browser tab and let me know if anything looks wrong.
>
> Postmortem (what failed and what I'm changing) by tomorrow evening.

**If still broken:**

> Still investigating. Current best-guess cause: [one sentence]. Likely fixed within [N] more minutes. If you need to take a payment in the next hour, do it on paper — I'll help you back-fill into Longrein once it's up.
>
> Next update by [time].

### Within 24 hours — postmortem to all founding members

**Subject:** Yesterday's outage — what happened and what changes

> Yesterday at [time], Longrein was down for [N] minutes. Here's exactly what happened:
>
> 1. [Trigger — what change or condition started it]
> 2. [Failure — what broke as a result]
> 3. [Detection — how I noticed]
> 4. [Resolution — what I did to fix it]
>
> What I'm changing so it doesn't repeat:
>
> 1. [Specific change — automated test, monitoring, code fix]
> 2. [Specific change]
>
> No data was lost. No customer was charged for the downtime (everyone is on free founding-member period anyway, but this is the policy that holds at month 13 too: SaaS downtime = service credit).
>
> If your stable was affected in a specific way I don't know about, tell me. — Andreja

---

## Crisis #2 — Data loss / corruption

**Use only if confirmed.** If unconfirmed, use Crisis #1 phrasing.

**Subject:** Some Longrein data may be affected — read this now

> At [time] I confirmed that [specific data type — e.g., lesson records from May 23–25 for some users] may be missing or incorrect.
>
> What I know:
>
> - Affected: [exact data, exact period, exact stables — name them]
> - Cause: [one sentence — be honest]
> - Recovery status: [restored from backup / partial / under investigation]
>
> What you should do now:
>
> 1. **Don't enter new data into [affected area] until I confirm full recovery** (next message by [time]).
> 2. If you have your own paper records of [affected data] from this period, keep them safe.
> 3. Reply to this email with any specific data you remember entering this week that you can't find now.
>
> I will personally restore your data and confirm with you, item by item, by phone if needed.
>
> — Andreja

**Follow-up within 24h with specifics per stable.**

---

## Crisis #3 — Email delivery broken (welcome / reset emails not arriving)

**Subject:** If you're not getting Longrein emails — read this

> Some Longrein emails are not arriving in inboxes today. I noticed at [time]. Cause: [one sentence — Resend issue, DKIM, etc.].
>
> If you're trying to:
>
> - **Log in** — use the password you set, not the magic link. If you can't remember, reply and I'll reset it manually.
> - **Onboard a new client** — wait until tomorrow, or I'll send their invite manually if it's urgent.
> - **Send a reminder** — those are still flowing fine; only [specific email type] is affected.
>
> Estimated fix: [time]. I'll send confirmation when normal. — Andreja

---

## Crisis #4 — Founding member discovers a serious bug

**Within 30 min of their report — to that founding member only**

> Hi [first name],
>
> I read your message. The bug you're describing — [one-sentence repeat of what they said, in your words, to confirm you understood] — is real. I am reproducing it now.
>
> Don't do anything different in the meantime. Your data is safe.
>
> Next update from me within 2 hours, with either the fix shipped or a workaround you can use today.
>
> — Andreja

**Within 2 hours — same person**

> Fixed. The issue was [one sentence]. The fix is live now (deploy [N] minutes ago).
>
> Try the thing again. Reply if it still fails.
>
> Thank you for catching this. I am specifically grateful — [name something specific they said that helped you find it]. — Andreja

---

## Crisis #5 — Founding member threatens to leave / says "this isn't working"

**Within 4 hours by phone — not email**

The script for the call:

1. (You) "I got your message. I want to understand exactly what isn't working. Can I ask three questions?"
2. (You, Q1) "When did you first feel this might not work?"
3. (You, Q2) "What were you hoping Longrein would do for your stable that it isn't?"
4. (You, Q3) "If I could change one specific thing right now, what would it be?"

**Don't defend. Don't sell. Listen and write down the words.**

5. (You, end) "Here's what I commit to: by [day], I'll have done [specific thing they said]. If by [date], that hasn't moved your view, I'll help you export your data and we part ways with no friction. Does that feel fair?"

**Within 24h after the call — written email with the commitments**

> Hi [first name],
>
> Thank you for the call. To make sure I have it right:
>
> What's not working for you:
>
> - [their words, summarized in 1 line]
> - [their words, summarized in 1 line]
>
> What I commit to:
>
> - By [date]: [specific deliverable]
> - By [date]: [specific deliverable]
>
> If by [check-in date] you don't see meaningful change, I help you export and you owe me nothing. No marketing tricks, no retention plays.
>
> — Andreja

**Whatever happens after that, document the conversation in `/founding-members/[stable-handle]/critical-call-[date].md`. This is your most valuable feedback all year.**

---

## Crisis #6 — Press / public criticism

**If a stable owner posts publicly something negative about Longrein on Instagram, LinkedIn, Facebook, or Reddit:**

**Within 24h — public reply (only if it's factually wrong or specific)**

Don't reply to vague criticism ("Longrein isn't great"). Do reply to specific criticism ("Longrein lost my lesson data on Tuesday").

> Hi [name], Andreja from Longrein here. I want to understand exactly what happened. Can I message you directly so I can pull up your account and check? My email is `hello@longrein.eu`. — Andreja

**Then:** in the DM, follow Crisis #4 protocol.

**If they refuse to talk privately:**

> Understood. If your concern is [specific — e.g., data loss], I want to be transparent: [the actual fact, with a link to the postmortem if there is one]. I won't argue further publicly — but my offer to look at your account directly stands. — Andreja

**Don't:**
- Engage with attacks on you personally
- Engage with vague accusations
- Counter-post your own version
- DM them three times — once is enough

---

## Crisis #7 — A competitor launches and a founding member asks about it

**Founding member writes:** "Hey, did you see [competitor] launched yesterday? They have [feature]. Should I be considering them?"

**Within 24h — direct answer**

> Hi [first name],
>
> I saw it. Quick honest take:
>
> - What [competitor] does well: [1-2 things, said straight, no spin]
> - What Longrein does that they don't: [1-2 specific things, with examples relevant to their stable]
> - What you'd lose by switching: [1 concrete thing — e.g., the founding-member contract, the welfare module, the locked €30/mo]
>
> If you want to compare side-by-side, I'll book a 30-min call where I show you both products on screen. No sales angle — your decision.
>
> — Andreja

**What this signals:** confidence. Stables hate vendors who panic when a competitor is mentioned. The founding member is testing whether you're a person who can be honest about your weaknesses.

---

## Crisis #8 — A founding member's data is at legal risk (subpoena, divorce, dispute)

**Most stables won't hit this. If they do, take it seriously.**

**Within 24h — phone call**

The script:

1. "I got your message about [the legal situation]. I want to make sure I handle this in a way that doesn't make things worse for you."
2. "Three things I can do: (a) export all your data and hand it to you for your records. (b) preserve your data in its current state for 90 days under a data hold. (c) connect you to my legal contact for stable owners in [country]."
3. "I will NOT proactively share your data with anyone — not your accountant, not your spouse, not a court — unless I receive a formally served subpoena from a court I'm legally bound to obey. Even then, I will tell you first."
4. "What do you need from me right now?"

**Document the call. File in `/legal/founding-member-incidents/[stable-handle]-[date].md`. If it gets formal, get a Lithuanian lawyer involved before responding to anything.**

---

## Crisis #9 — You (Andreja) need to step away (illness, family, burnout)

**This is the one nobody plans for. Plan for it.**

**Within 24h of knowing you'll be unavailable for 3+ days — to all founding members**

**Subject:** I'm offline [start date] – [end date] — coverage plan

> Hi [first name],
>
> I'll be offline from [start date] to [end date] because [optional brief reason — only if you're comfortable, otherwise just "personal reasons"].
>
> What this means for you:
>
> - Longrein keeps running. Servers are stable; nothing breaks because I'm offline.
> - Urgent issues (production down, data loss): email `hello@longrein.eu` AND text my mobile [+370...]. I will respond within 24h even when offline; if I can't, [backup contact name + email] will.
> - Non-urgent (feature requests, questions): I'll batch-reply when back. Don't worry about being slow to hear back.
>
> If something is broken and I'm unreachable, here's the export-everything path: Settings → Backup → CSV export. You always have your data.
>
> Back on [end date]. — Andreja

**Internal action:**
1. Set Gmail vacation responder pointing at [backup contact].
2. Document your runbook for the backup contact (what to escalate, what can wait).
3. Pre-pay 3 months of Vercel + Supabase + Resend so nothing turns off due to a missed credit card while offline.

---

## The hour after any crisis communication

After you send any message above, do these in order:

1. **Open the tracker.** Note in each affected member's row: incident type, date, communications sent, current status.
2. **Drink water. Walk outside for 10 min.** No phone.
3. **Don't check inbox for 30 min.** Replies will pile up. Read them in one batch when calm.
4. **Reply to each in the order they arrived.** Even the angry ones. Especially the angry ones.

---

## What never to do under crisis

- Don't blame Vercel / Supabase / Resend in customer-facing comms. They're your sub-processors. The customer's contract is with you.
- Don't say "this has never happened before" unless that's literally true.
- Don't promise a fix timeline you're <90% sure of.
- Don't use the words "rest assured", "deepest apologies", "robust solution", or "we are committed to".
- Don't send a crisis email at 23:00. Wait until 07:00 the next morning unless people's data is actively at risk in the next hour.
- Don't apologize more than once in any single message. Once, specifically, then move to action.

---

## After 6 months, this file gets updated

Each crisis you actually handle adds to this file. Replace the templates with your real-world version. By month 12, this is your operating manual — not generic guidance.

— print this. Tape it under your laptop. Hope you never need it.
