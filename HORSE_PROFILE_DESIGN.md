# Horse Profile — Premium Design System

> **Schema reality check (added after first pass)** — when this doc was first written, the assumption was that `horses` had no owner column. In fact, migrations 12–15 already cover most of the foundation: `12_sessions.sql` (sessions table + `session_type` enum + `v_horse_activity_7d` view), `13_sessions_policies.sql` (full RLS for sessions including the staff/client split), `14_horse_photos.sql` (`horses.photo_url` + Storage policies), `15_horse_owner.sql` (`horses.owner_client_id` + same-stable trigger + RLS extension that lets a horse-owner client read all sessions on their horse). So §2 (data model gap) is already solved — but with the column named **`owner_client_id`** (FK to `clients.id`, not `profiles.id`), which is actually a better choice: horse owners are almost always clients/boarders, and this aligns with how billing already flows. Treat §2 as historical context and §11 (RLS) as already done. The rest of the spec stands.

The Horse Profile is the gravitational centre of the product. Every other module — Sessions, Calendar, Clients, Payments — is in some sense in service of the horse. This document defines the structure, role-based visibility, visual system, and interactions for that single screen, plus the data model gap it implies.

The design target is a quiet, expensive feel — closer to Apple Fitness, Strava, and Notion than to a stable-management form-builder. The product's job is to make the data feel *known*, not catalogued.

---

## 1. Concept

Horse Profile = a single, scrollable hub with a sticky hero, a small set of tabs, and a right-rail for time-sensitive actions. Three role lenses (Owner / Trainer / Client) render the *same canonical screen* with progressively narrower data. We never build three separate screens — we build one and show fewer cards.

Why one screen: it lets the brand language stay consistent across the org, and it lets us harden one route end-to-end (RLS, instrumentation, performance) instead of three.

---

## 2. Data model gap (must address before build)

The brief introduces `OWNER (horse owner)` as a role lens. The current schema has:

- `user_role` enum: `owner | employee | client` — this is **stable-wide**, not horse-specific
- `horses` table — no owner column

So "horse owner" is a **new concept**. Two options:

**Option A — single owner field (recommended for MVP)**

```sql
alter table horses
  add column owner_profile_id uuid references profiles(id) on delete set null;

create index horses_owner_profile_id on horses(stable_id, owner_profile_id);
```

A horse has zero or one owner; the owner is a profile in the same stable (FK validated by a same-stable trigger, mirroring `lessons_enforce_same_stable`). The horse owner can be any role — a `client` (most common — boarder owns their horse), an `employee` (staff horse), or `owner` (stable-owned).

**Option B — junction table (future-proof, defer to v2)**

```sql
create table horse_owners (
  stable_id   uuid not null references stables(id) on delete cascade,
  horse_id    uuid not null references horses(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  share_pct   numeric(5,2),     -- optional, for syndicates
  primary key (horse_id, profile_id)
);
```

Supports co-ownership / syndicates. Nice-to-have, not blocking.

**Decision**: ship Option A now. The UX maps cleanly to "this horse belongs to X". Co-ownership can grow into a junction table without breaking the column (keep both during a migration window).

A second derived concept the UI needs is **rider attachment** — a Client may regularly ride a horse without owning it. We don't need a new table; this is derivable from `lessons.client_id` joined to `lessons.horse_id` over a recent window (last 90 days, ≥ N lessons). Call it a "regular rider" and surface it in Header / Activity for Trainer + Owner views.

---

## 3. Role definitions (in horse-profile context)

| Role | Who | Default privileges on this horse |
|------|-----|-----------------------------------|
| **Horse Owner** | The profile in `horses.owner_profile_id`. Could be a `client` (boarder), `employee`, or stable `owner`. | Sees everything. Sets long-term goals. Approves vet/farrier records. Cannot edit training notes (that's Trainer territory) but can comment. |
| **Trainer** | Any profile with role `employee` or `owner` in the same stable. | Full operational access — adds sessions, notes, health entries, schedules, uploads media. Cannot transfer ownership. |
| **Client (rider)** | Any profile with role `client` who has lessons on this horse, but is **not** the horse owner. | Sees only what's relevant to their riding: their own session history on the horse, abstract health status (no medical detail), their upcoming lessons. Never sees other clients' data, owner identity, financials, or unredacted vet records. |

A horse owner who is also a client riding their own horse gets the **Owner** lens (highest privilege wins). A stable owner who is not the horse owner still sees everything via the Trainer lens (operationally identical).

---

## 4. Permission matrix

This is the source of truth. Build the screen *from this table*; never invent role-conditional logic outside of it.

| Section / field | Horse Owner | Trainer (employee + stable owner) | Client (rider, not owner) |
|---|---|---|---|
| **Hero — name, photo, breed, age, status** | full | full | full (status shown as "Available" / "Resting" only) |
| **Hero — owner identity** | full | full | hidden |
| **Hero — financial badges** (e.g. board paid, balance) | full | hidden | hidden |
| **Hero — quick actions** | "Add session", "Schedule lesson", "Add note" | same + "Edit horse", "Add health record" | "Book lesson" only |
| **Activity — weekly volume + workload meter** | full | full + cap warnings | only their own contribution to volume |
| **Activity — heatmap of last 12 weeks** | full | full | only their own sessions appear |
| **Activity — training type breakdown** | full | full | own sessions only |
| **Sessions — list (date, trainer, rider, type, intensity)** | full read | full read + edit own + edit others' (employees) / all (stable owner) | own only — sees their lesson rows, no row for any other client |
| **Sessions — notes (free text)** | read | read + edit | hidden by default; trainer can mark a note `visible_to_rider=true` to share |
| **Sessions — add new** | yes (any rider on this horse) | yes | no — they request via Book lesson |
| **Health — current status (Healthy / Limited / Resting)** | full | full | full |
| **Health — vaccinations list + due dates** | full | full | hidden |
| **Health — vet visits (date, reason, notes)** | full | full | hidden |
| **Health — farrier records** | full | full | hidden |
| **Health — injury timeline** | full | full | only "Currently restricted" badge in hero, no detail |
| **Health — add record** | no | yes | no |
| **Goals — long-term horse goals** (e.g. "Prepare for L1 dressage by Sept") | sets + edits | sees + comments | hidden |
| **Goals — per-rider training arc** | sees all riders' arcs | sees + edits all | sees only their own arc |
| **Schedule — next 7 days, all bookings** | full | full | hidden — sees own bookings only |
| **Schedule — own upcoming lessons** | full | full | full |
| **Media — photos / videos** | full + upload | full + upload + tag riders | sees only media tagged to them |
| **Activity log / audit trail** | full | full | hidden |
| **Comments thread (optional v2)** | participates | participates | participates only on items they can see |

**Cross-cutting rule**: every query the page issues must already pass RLS. The role lens is a *display* filter, not a security boundary. If a row is loaded into the page, RLS already proved the user is allowed to see it. The lens decides whether to render it.

This means the existing `clients_read_self`, `lessons_read_client`, `payments_read_self` policies do most of the work. The only new policy needed is for horse-owner reads — see §11.

---

## 5. Layout architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Sticky hero (140px)                                        │
│  ┌──────┐  Horse name (serif, 32px)        ┌─────────────┐ │
│  │photo │  Breed · Age · Status pill       │Quick actions│ │
│  └──────┘  ─────────────────────────       └─────────────┘ │
│            KPI strip (4 small cards)                        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────┐ ┌──────────────────┐
│ Tabs: Overview · Sessions · Health  │ │ Schedule rail    │
│       · Goals · Media               │ │ (sticky right)   │
│ ─────────────────────────────────── │ │                  │
│                                     │ │ Today            │
│ Tab content scrolls here            │ │ ─ 09:00 lesson   │
│                                     │ │ ─ 14:00 lesson   │
│                                     │ │                  │
│                                     │ │ Tomorrow         │
│                                     │ │ ─ 10:30 lesson   │
│                                     │ │                  │
└─────────────────────────────────────┘ └──────────────────┘
```

- **Sticky hero**: 140px tall on desktop, collapses to 88px on scroll (photo shrinks, KPIs hide). Always shows name + status pill.
- **Tabs**: 5 max. The order matters — Overview is the daily-use view, Sessions is the history grid, Health is the rare-but-critical detail, Goals is reflective, Media is decorative. Default to Overview.
- **Right rail (desktop ≥ 1024px only)**: sticky 280px column with the 7-day schedule and quick-add. Disappears on tablet/mobile and folds into the Schedule tab.
- **Mobile (≤ 768px)**: hero collapses to 96px, photo becomes a 56px circle next to the name. Tabs become a horizontal scroll pill row. Schedule rail moves below tab content.

The "expensive" feeling comes from three levers: (a) generous whitespace in the hero, (b) one serif weight for the horse name, (c) restrained colour — earth tones from the existing brand, never neon.

---

## 6. Section design

### A. Activity Overview (default tab)

Purpose: answer "how is this horse being used" in five seconds.

Components, top to bottom:

1. **Activity ring** — a single 96px ring showing this week's lesson count vs. the horse's `weekly_lesson_limit`. Uses brand-600 stroke when ≤ 80%, amber when 80–100%, red when over. To the right of the ring, a 13px label: `12 of 20 lessons this week`. Strava-style minus the over-design. *(Trainer/Owner only — Client sees this calculated only against their own sessions: `3 of your 5 weekly rides`.)*

2. **12-week heatmap** — 12 columns × 7 rows of 8px squares. Each square: 0–N lessons that day, opacity scales 0.1 → 1.0 on brand-600. GitHub-contributions style but warmer. Hover = tooltip with day + count. *(Owner/Trainer: full data. Client: only days they rode.)*

3. **Workload meter** — horizontal bar showing cumulative ride time this week (minutes), with the daily cap as a tick mark. Subtle by default; turns amber if approaching, red if over. *(Trainer + Owner only.)*

4. **Training type breakdown** — donut chart with up to 4 slices: Dressage / Jumping / Hack / Lunging (or whatever lesson types are tracked). 80px diameter, slim. Below the chart, a 4-row legend with percentages. *(Owner/Trainer: full. Client: their session breakdown only.)*

The whole tab fits in one viewport on a 14" laptop without scrolling. That's the bar.

### B. Sessions (training history)

A reverse-chronological list grouped by date. Each row is an 80px card.

```
┌───────────────────────────────────────────────────────────┐
│ Mon · Mar 16                                              │
│ ─────────────────────────────────────────────────────── │
│ ┌──┐  09:00 — 10:00       Dressage        Mod intensity  │
│ │EM│  Ema Mickevičiūtė    w/ Andreja                     │
│ └──┘  "Working trot transitions, schooling rein-back"    │
│                                                  ▸ 1 note │
└───────────────────────────────────────────────────────────┘
```

Fields per row:
- Time window (start–end)
- Training type pill (sentence case, soft fill)
- Intensity (Light / Moderate / Hard) — single word, ink-500
- Rider initials avatar + full name (linked to client profile, owner/trainer only)
- Trainer name with `w/` prefix
- Note preview (one line, ink-700) — full note expands on click into a slide-down panel

Filters at the top of the tab:
- Date range (last 30 days / last 90 / this year / all)
- Trainer (multi-select)
- Type (multi-select)
- "Has notes" toggle

**Add session** affordance: a sticky `+ Add session` button bottom-right of the tab. Tapping opens a 4-field bottom sheet (date+time, rider, trainer, type) with intensity defaulting to Moderate. No notes field at first — notes are added inline on the row after the session is created. This keeps the create flow under three seconds.

**Client view of this tab**: only their own rows. The grouping headers stay (Mon · Mar 16). If they have no sessions, an empty state with a "Book a lesson" CTA.

### C. Health & care

Three status cards on top, each 1/3 width, then a stacked timeline below.

**Status cards** (premium feel — flat, no gradients):

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Vaccinations    │  │ Farrier         │  │ Vet             │
│                 │  │                 │  │                 │
│  ✓ Up to date   │  │  Due in 18 d    │  │  Last visit     │
│                 │  │                 │  │  Feb 12         │
│  Next: Sep 14   │  │  Aug 28         │  │  Routine check  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

Status is the hero of each card. Brand-tone left border for "good", amber for "due soon", red for "overdue". Status word ≤ 3 words.

Below: **timeline of records** — vet visits, farrier sessions, vaccinations, injuries — single feed, newest first. Each record is a 1-line row that expands into full notes on click. Inline `+ Add record` at the top of the timeline (Trainer only).

**Injury timeline** is a special filter chip on the timeline ("Show injuries only") — it pulls injury records into focus when you need them, but doesn't require a separate tab.

**Client view of Health**: zero detail. Just the three status cards, status word only. No dates, no notes, no timeline. If the horse is on rest/restriction, an extra banner: *"This horse is currently on light work — your trainer will adapt your lesson."*

### D. Goals & progress

Two sections:

**Long-term horse goals** — up to 3 active goals, Notion-card style:

```
┌─────────────────────────────────────────┐
│ Goal · Active                           │
│ Prepare for L1 dressage test by Sep 1   │
│ ──────────────────────────────────────  │
│ Progress  ████████░░░░░░ 56%            │
│ Last update · 4 days ago by Andreja     │
└─────────────────────────────────────────┘
```

- Set by Owner. Editable by Owner + Trainer.
- Progress bar is *manually* set by the trainer in 10% increments (avoid building progress-tracking ML). Honest, simple.
- Comment thread on each goal (v2).

**Per-rider training arc** — a single horizontal lane per rider showing 4 milestones: Start → Foundations → Building → Goal. The current position is a filled dot. Trainer drags between milestones to update.

Owner sees all riders' arcs (they own the horse, they should know who's progressing). Each rider sees only their own arc — no comparison, no leaderboard.

### E. Schedule

The right-rail covers most of this on desktop. The Schedule **tab** is the full week and the next two weeks ahead, stacked.

For each day:
- Day header (Mon · Mar 16)
- List of lessons: time, rider, trainer, type — same row chrome as Sessions list
- Empty days collapse into "No lessons" muted line

Trainer + Owner: full week of all bookings on this horse.
Client: only their own bookings, plus the dates they've requested.

**Click a row** → opens the lesson detail sheet (existing `lessons` data).
**+ Book lesson** floating button → existing booking flow, prefilled with this horse.

### F. Media

A 4-column grid of square thumbnails (160px on desktop, 96px on mobile). Each thumb shows a play overlay if it's a video.

- Trainer can upload + tag specific riders ("This video is for Maya"). Tagged riders get the file in their view; untagged files are private to the staff lens.
- Client sees only files tagged to them, in a single grid. No upload affordance.
- Owner sees everything.

This section is **deferred** in MVP — flag it as v2. The schema and storage bucket are simple to add later (Supabase Storage with `horse_media/{stable_id}/{horse_id}/...` plus `media_recipients (media_id, profile_id)` table).

---

## 7. Visual system

The product already has a strong palette (brand orange `#B25430` family, ink grays, off-white surface). The Horse Profile leans into that, with two intentional upgrades:

### Colour

- **Background**: `#FAF8F4` (warm off-white). The page never sits on pure `#FFFFFF` — that's the surface inside cards.
- **Surfaces**: `#FFFFFF` for cards. Subtle `1px solid rgba(35, 30, 28, 0.06)` border for separation. No drop shadows on cards in the body — only the sticky hero gets a `0 1px 0 rgba(0,0,0,0.04)` to anchor it when scrolled.
- **Brand action**: `#B25430` (already in tokens). Used sparingly — primary CTA, active ring, "today" markers. Not for big surfaces.
- **Accent (status)**: amber `#C2841A` for "due soon", red `#B23838` for "overdue", green `#5A7A3A` for "healthy". All muted, not saturated.
- **Text**: `#231E1C` (ink-900) for primary, `#5A4F49` (ink-700) for secondary, `#8A8079` (ink-500) for tertiary metadata. Three steps maximum.

### Typography

Two families, three weights, four sizes. That's the entire system.

| Use | Family | Size | Weight |
|---|---|---|---|
| Horse name (hero) | Fraunces (serif) or Söhne Breit | 32px / 28px on mobile | 500 |
| Section title | Inter | 14px | 600 |
| Body | Inter | 14px | 400 |
| Metadata / labels | Inter, tracked +0.04em | 11px uppercase | 500 |

The serif on the horse name is *the* premium tell. Everything else is sans, which keeps screens calm.

### Spacing

8 / 12 / 16 / 24 / 32 / 48. No values outside this list. Page padding 24 / 32 / 48 by breakpoint.

### Cards

- Radius: 16px (existing convention is 12px → bump to 16 for the profile to feel a touch more editorial)
- Padding: 20px on body, 16px on compact rows
- Border: `1px solid rgba(35, 30, 28, 0.06)`
- Hover: border tightens to `rgba(35, 30, 28, 0.12)`. No shadow lift in body (avoid Bootstrap-y feel). The sticky hero is the only thing with a shadow.

### Icons

Phosphor (regular weight) at 16px and 20px sizes. Stroke 1.5. Never solid icons — outline only in this product. One-off SVGs for specific glyphs (horse silhouette in avatar fallback) authored in-house, same stroke weight.

### Photography

The horse photo in the hero is the only large image in the product. It carries a lot of weight. Defaults:
- 96px square, 16px radius, 1px white inner border for definition against the warm background
- Fallback: a soft warm gradient with the horse's initial in serif. Never a stock illustration of a horse.

---

## 8. UX architecture & interactions

**Navigation in**: from the Horses list, click a row → `/dashboard/horses/{id}`. From a lesson row anywhere in the app, the horse name is a link → opens the profile.

**Default tab**: Overview always. Tab state lives in the URL (`?tab=sessions`) so bookmarks and back-button work.

**Add session — three seconds, four taps**:

1. Tap `+ Add session` (bottom right of Sessions tab)
2. Bottom sheet opens with date+time prefilled to "now, rounded to next 15 min"
3. Pick rider (autocomplete from this horse's recent riders, or any client)
4. Pick trainer (defaults to current user if they're a trainer)
5. Pick type (chip group, 4 options visible, tap one)
6. Save → sheet closes, new row appears at the top of the list with a soft fade

If the user wants to add a note, the row has a `+ note` affordance — tap, write, save inline. We never block the create flow on a note.

**Edit session**: long-press / right-click on the row → context menu (Edit / Delete / Add note). Trainers and stable owner only.

**Keyboard shortcuts** (desktop):
- `J` / `K` — next / previous session in the list
- `S` — open Add session sheet
- `B` — Book lesson
- `1–5` — switch tabs
- `?` — show shortcut overlay

**Loading**: skeleton screens that match final layout (no spinners). Hero photo is the only thing that can briefly fade in — everything else lays out instantly with placeholder shapes.

**Empty states** are first-class. Each section has its own:
- Sessions: "No sessions yet for this horse. Add the first one to start tracking." + CTA
- Health: "All clear. No health records on file." (this is good news)
- Goals: "Set a goal to give this horse a north star." + CTA (Owner) or "Your trainer hasn't set a goal yet." (Client)

---

## 9. Simplicity audit

Every section was checked against three rules:

1. **One thing per card.** A card answers one question. The Activity ring shows volume, period. The workload meter is its own card. We resist combining "this is the volume AND the cap AND the trend" into one over-loaded chart.
2. **Five tabs maximum.** We have exactly five. If you ever want a sixth, demote one of the existing five to a section in another tab.
3. **Forms ≤ 4 fields per step.** The Add session sheet is 4 fields. Adding a health record is 4 fields (type, date, who, brief note — full notes are inline-edited after creation). If a form is bigger than that, it becomes a multi-step wizard.

Things we considered and **deliberately cut**:

- Per-horse expense ledger on this page — lives in Expenses module instead, accessible via a "View ledger" link only.
- Diet / feeding plan section — out of scope for v1; many stables use a separate feeding board.
- Comparison view ("how does this horse compare to other horses in the stable") — anti-pattern, encourages bad welfare decisions.
- Public link / shareable profile URL — privacy nightmare without thinking it through. Defer.
- AI-generated training summaries — we don't have the data quality yet, and stables don't trust them.

---

## 10. Implementation order

Phased so each phase is shippable and adds visible value.

**Phase 1 — Foundation (1 sprint)**
- Add `horses.owner_profile_id` column + RLS policy update
- Build new sticky hero + tab shell
- Wire Overview tab with existing data (lessons → activity ring, heatmap, workload)
- Sessions tab with read + filter only (add later)

**Phase 2 — Operations (1 sprint)**
- Add session bottom sheet (4-field flow)
- Inline note editing on session rows
- Health & care tab, status cards + timeline (without media)
- Schedule tab + right rail

**Phase 3 — Reflection (1 sprint)**
- Goals & progress tab
- Per-rider training arc
- Activity log (audit trail, hidden from clients)

**Phase 4 — Polish (½ sprint)**
- Keyboard shortcuts + ? overlay
- Empty state illustrations (in-house, abstract)
- Skeleton loaders that match final layout
- Hero photo upload + crop

**Phase 5 — Media (1 sprint, deferred)**
- Supabase Storage bucket + RLS
- Upload + tag flow (trainer)
- Filtered grid (client / owner)

---

## 11. Security notes (RLS additions required)

Most of the role logic falls out of the existing policy set, but two additions are needed:

1. **Horse owner read of their horse's lessons** — currently `lessons_read_staff` and `lessons_read_client` cover staff and rider-clients. A horse-owner client who *doesn't* ride the horse would get nothing. Add:

   ```sql
   create policy lessons_read_horse_owner on lessons
     for select
     using (
       stable_id = current_stable_id()
       and exists (
         select 1 from horses h
         where h.id = lessons.horse_id
           and h.owner_profile_id = current_user_id()
       )
     );
   ```

2. **Horse owner read of horse health records** (when those tables exist in v2). Same shape: SELECT allowed if `current_user_id()` matches the horse's `owner_profile_id`.

Trainer/employee permissions are covered by existing `_read_staff` policies. No changes needed for the stable owner.

The same-stable trigger pattern applies to any new horse-owner-related row: the linked profile's `stable_id` must equal the horse's `stable_id`.

---

## 12. Open questions

1. Single-owner column (Option A) vs. junction table (Option B) — recommendation A for now, but confirm.
2. Does the brand have a serif licensed already (Fraunces / Söhne Breit / GT Sectra)? If not, Fraunces is free on Google Fonts and reads premium. The horse name is the only place it appears, so licensing cost is low.
3. Media uploads — Supabase Storage now or v2? Recommendation: v2.
4. Comments thread on goals and sessions — v2 or never? Light-touch comments add a lot of warmth but also moderation work. Recommendation: v2, opt-in per stable.
