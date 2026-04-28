# Target List — How to Use It

Companion to `target-list-template.csv`. The list is your single source of truth for the first 90 days. Open it every morning. Update it every send.

---

## How to set it up

**Option A — Google Sheets (recommended for solo founder):**
1. Open `target-list-template.csv` in Google Sheets (`File → Import → Upload`).
2. Freeze the header row.
3. Add data validation for `status` and `icp_score` columns.
4. Add conditional formatting: rows with `status = customer` go green, `declined` goes grey, `nurture` goes pale yellow.
5. Pin the sheet in your browser tab bar.

**Option B — Airtable (better at 50+ stables):**
1. Create a base, import the CSV.
2. Convert `status` to a single-select with the options below.
3. Convert `icp_score` to a rating field (1–5).
4. Add a Kanban view grouped by `status`.
5. Add a calendar view on `next_action_date`.

---

## Column definitions

| Column | What goes in it |
|---|---|
| `stable_name` | Official name |
| `country` | ISO 2-letter code (DE, AT, NL, PL, FR, IT, ES, etc.) |
| `city` | Closest city |
| `type` | `school` / `training` / `mixed` / `boarding` |
| `est_horses` | Best guess from website / IG photos |
| `lead_name` | Owner or head trainer's full name |
| `lead_role` | Owner / Head Trainer / Manager |
| `instagram` | Handle including @ |
| `website` | Domain only, no `https://` |
| `email` | If publicly listed |
| `phone` | International format if known |
| `trigger_signals` | Recent post, hire, expansion, complaint — anything signalling buying intent |
| `source` | Where you found them (IG explore, hashtag, referral, fair, search) |
| `icp_score` | 1 (poor fit) to 5 (perfect ICP) |
| `status` | See below |
| `first_contact_date` | YYYY-MM-DD |
| `last_contact_date` | YYYY-MM-DD |
| `next_action` | Plain English, e.g. "Send variant A", "Follow-up 1", "Visit Friday 10am" |
| `next_action_date` | YYYY-MM-DD |
| `notes` | Anything you'd want to remember in 30 days |

---

## Status values (in flow order)

1. **researched** — added to list, not contacted
2. **contacted** — first DM sent, awaiting reply
3. **replied** — they replied, conversation in progress
4. **meeting_set** — call or visit booked
5. **demo_done** — demo complete, awaiting decision
6. **trial** — on a free trial
7. **customer** — paying
8. **declined** — explicit no
9. **nurture** — passive: check back in 6 months

---

## ICP scoring (how to decide 1–5)

Score each stable across the four dimensions, average them, round to nearest integer:

| Dimension | 1 | 3 | 5 |
|---|---|---|---|
| **Size** | <5 horses | 8–35 horses | exactly 12–25 horses |
| **Type** | Pure boarding / breeding | Mixed | Riding school or training |
| **Tech-readiness** | No website, no IG | Active IG, no software | Already uses some app |
| **Trigger event** | None visible | Some growth signals | Active hiring or expansion post |

A score of 5 means: contact today. A score of 3: contact this week. A score of ≤2: skip for now, add to nurture.

---

## Daily rhythm

**Every morning (10 minutes):**
- Filter to `status = contacted` and `last_contact_date` 4+ days ago. Send Follow-up 1.
- Filter to `status = contacted` and `last_contact_date` 10+ days ago. Send Follow-up 2.
- Filter to `next_action_date = today`. Do those actions.

**Every evening (5 minutes):**
- Update `last_contact_date` and `notes` for any sends.
- Move statuses for any replies.

**Every Friday (30 minutes):**
- Add 20 new stables to the bottom of the sheet.
- Score them.
- Plan Monday's sends.

---

## Where to find stables

In priority order:

1. **Instagram hashtag search.** `#reitschule`, `#reitstall`, `#showjumping`, `#dressage`, plus your local-language equivalents.
2. **Instagram explore.** Once you follow 10 stables, the algorithm hands you another 50.
3. **Google Maps.** Search "riding school near [city]" — every stable will appear.
4. **Equestrian federation directories.** Most countries publish member lists by federation (e.g. FN.de in Germany).
5. **Local equestrian fairs.** Pferd International, Equitana, regional fairs.
6. **Referrals from your first conversations.** Always ask "who else should I talk to?" at the end of every meeting.

**Aim:** 30 stables identified by end of Week 1. 100 by end of Month 1.

---

## What "good" looks like

After 4 weeks of daily rhythm:

- 80–120 stables in the sheet
- 60+ contacted
- 15–25 replied
- 5–8 meetings done
- 1–3 paid trials started

After 8 weeks:

- 150+ stables in the sheet
- 5 paying stables
- 2–3 active trials

If you're below these numbers, the issue is almost always (a) message quality or (b) follow-through speed — not list size. Don't add more names. Sharpen the conversation.
