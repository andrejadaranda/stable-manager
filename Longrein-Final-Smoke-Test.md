# Final smoke test — pre-launch verification

**Run this 24 hours before launch (Friday 2026-05-22, evening).** Walks every critical surface end-to-end. Total: ~45 min. Failing any item = block launch + fix immediately.

---

## Setup

- One incognito Chrome window (clean state, no cached sessions)
- One real iPhone (cellular data on, NOT same Wi-Fi as laptop) — for mobile leg
- Two email addresses you control:
  - **A**: `darandaandreja+launch-owner@gmail.com` — fresh stable owner
  - **B**: `darandaandreja+launch-client@gmail.com` — invited rider
- Stop watch (or just clock) — real-time flow has to feel fast

---

## Section 1 — Public surfaces (5 min)

- [ ] **`https://longrein.eu`** loads. Cream + Paddock Green hero. Tagline "Run the yard. Protect the horses." visible. No 500. No console errors.
- [ ] **`https://www.longrein.eu`** redirects to `https://longrein.eu`.
- [ ] **`https://app.longrein.eu`** loads login page with HTTPS lock + Longrein. wordmark.
- [ ] Cookie banner appears bottom-left on first visit. Click "Reject non-essential" → banner dismisses.
- [ ] Footer links work: `/legal/terms`, `/legal/privacy`, `/legal/cookies` — all three load with brand chrome + back-to-home link.
- [ ] **Waitlist form on landing**: enter `darandaandreja+launch-waitlist@gmail.com`, submit. Should show "Thanks. You'll hear from us soon." (or equivalent). Verify in Supabase → Table Editor → `waitlist_signups` → row exists with that email.

---

## Section 2 — Fresh-account signup + first lesson (15 min)

This is **the** pre-launch checkpoint. Time it. Target: <30 min from signup to first lesson logged.

- [ ] Open `https://app.longrein.eu/signup` incognito.
- [ ] Fill: name `Launch test owner`, stable name `Launch test stable`, handle `launch-test`, email **A**, password `LaunchTest2026!`. Submit.
- [ ] **Within 30 seconds**: confirmation email arrives in Gmail Inbox (NOT Spam). From: `Longrein <hello@longrein.eu>`. Subject: `Welcome to Longrein. Confirm your email.` Body has Paddock Green wordmark + Confirm email button.
- [ ] Click "Confirm email →" button in the email. Browser opens; should land on `app.longrein.eu/dashboard` logged in as Launch test owner.
- [ ] **Onboarding tour**: 5-step welcome tour appears. Step through it. Each step's CTA link works.
- [ ] **Add first horse**: Sidebar → Horses → +Add horse. Fill: name `Test Horse 1`, weekly limit `8`. Save. Should appear in horses list.
- [ ] **Add second horse**: Same flow, name `Test Horse 2`. Save.
- [ ] **Add first client**: Sidebar → Clients → +Add client. Fill: name `Test Client 1`, email **B**, phone `+37060000000`. Save. Should appear in clients list.
- [ ] **Schedule a lesson**: Calendar → click empty slot tomorrow 14:00 → fill: client `Test Client 1`, horse `Test Horse 1`, duration 60min, price €25. Save. Lesson appears in calendar.
- [ ] **Mark lesson paid**: Click the lesson card → "Mark paid" → method: Cash → Save. Status changes to Paid (green badge).
- [ ] **Log a session**: Sidebar → Sessions → "+ Log session". Fill: horse `Test Horse 2`, type Training, duration 45min. Save. Session appears in recent.
- [ ] **Welfare dashboard**: Sidebar → Welfare. Should show 2 horses across the 5 buckets. Click any tile to filter.
- [ ] **Per-horse profitability**: Horses → Profitability. Should show `Test Horse 1` with €25 revenue, €0 expenses, €25 net.

**STOP CLOCK.** Should be ≤30 min. If >30 min — write down where you got stuck, prioritize that as #1 fix.

---

## Section 3 — Client portal (5 min)

- [ ] Open second incognito window. Go to `app.longrein.eu/login`.
- [ ] Sign in with email **B** (the test client). She should have received a password-set link OR an account auto-created. (If not yet auto-created, skip this section and add to fix list.)
- [ ] Land on `/dashboard/my-lessons`. See the scheduled lesson with `Test Horse 1` tomorrow 14:00.
- [ ] Click lesson. Detail view shows date, horse, trainer, status (Paid).
- [ ] `/my-payments` — see €25 paid (Cash, today's date).
- [ ] `/my-horses` (if enabled) — see horses she's ridden.
- [ ] `/my-sessions` — empty (she didn't ride one yet).
- [ ] **Important: she should NOT see other clients, other lessons, payments, or any owner-only data.** Verify by going to `/dashboard/clients` — should redirect or show empty / forbidden.

---

## Section 4 — Mobile (10 min) — REAL phone, cellular

Pull out your iPhone. Disconnect from Wi-Fi (cellular data). This is the trainer-in-the-arena experience.

- [ ] Open Safari → `app.longrein.eu`. Sign in as owner (email **A**).
- [ ] **Calendar week view** loads readably. Drag a lesson to a different time. Save works.
- [ ] **Horse profile** opens. Sticky header doesn't break. Tabs work.
- [ ] **Quick-add session** bottom sheet: Sidebar → Sessions → +. Fill 4 fields with thumb only (no zoom). Save.
- [ ] **Welfare board** — bucket cards readable. Tap one. Horse cards readable. Tap horse → profile loads.
- [ ] **Cmd+K equivalent** (search): if there's a mobile search shortcut, test. If not — note as friction.
- [ ] **PWA install**: Safari Share → Add to Home Screen. Open from home screen. Status bar matches Cream theme. Hidden Safari chrome.
- [ ] **Sign out + sign back in**: Settings → Sign out. Sign in again. Session persists across browser closes? (Depends on Supabase persistSession config.)
- [ ] **Unpaid boarder mark-paid flow**: Settings → Boarding → tap any unpaid boarder → method picker → Cash → confirms. List updates.

If anything blocks a real workflow — note it as a launch-day P0 fix.

---

## Section 5 — Email rest of the templates (5 min)

These are sent rarely but every founding member will hit at least one in their first 30 days.

- [ ] **Password reset**: Login page → "Forgot password?" → email **A** → submit. Reset email arrives in Inbox from `hello@longrein.eu` within 30s. Click link. Set new password. Sign back in.
- [ ] **Magic link** (if enabled): Login page → "Sign in with magic link" → email **A**. Magic link email arrives. Click. Logs in.
- [ ] **Team invite**: Settings → Team → Invite → email `darandaandreja+launch-trainer@gmail.com`, role: Employee. Submit. Invite email arrives. Click. New trainer can set password and sign in.

If any of these templates is the default Supabase styling (not brand-styled): note as polish item, NOT a P0 blocker. The first impression is Confirm signup which is brand-styled.

---

## Section 6 — Cleanup + final verifications (5 min)

- [ ] **Resend → Logs**: should show 4–6 emails sent in the last 30 minutes. All "Delivered" status. None bounced.
- [ ] **Supabase → Logs → Auth**: no 5xx errors during the test session.
- [ ] **Vercel → Deployments**: latest production deploy is green (no warnings).
- [ ] **TypeScript** (run from Terminal): `cd ~/Documents/Claude/Projects/APP && npx tsc --noEmit`. Should exit 0.
- [ ] **No console errors** in the incognito browser DevTools throughout the smoke test.
- [ ] **Cleanup test data**: Delete `Launch test stable` from Supabase Auth Users (or leave — doesn't affect prod). Same for the +launch-* email rows in `waitlist_signups`.
- [ ] **Audit log on owner side**: Settings → Activity → see all the writes you just did, attributed to your test owner.

---

## Pass/fail decision

**PASS** if:
- All Section 1 + 2 + 3 + 4 items checked.
- Time-to-first-lesson under 30 minutes.
- No P0 (blocker) issues that would break a real founding member's first hour.

**FAIL** if any of:
- Welcome email doesn't arrive in Inbox.
- A Section 2 step throws a 500 error.
- Mobile calendar week view is unusable on iPhone.
- A client can see another client's data.
- Time-to-first-lesson is over 45 minutes.

---

## If it fails

1. Don't launch tomorrow. Push launch to Tuesday 2026-05-26.
2. Identify the one specific failure.
3. Fix it (or have me fix it).
4. Re-run only the failing section.
5. If it passes, launch.

The 10 founding members aren't going anywhere. A brittle launch experience that leaves them unable to use the product is far worse than a 3-day delay.

---

## After PASS — last actions before sleep

- [ ] Final commit + push of any fix-up changes from the smoke test.
- [ ] Confirm Vercel auto-deployed latest commit (~60s).
- [ ] Re-test the welcome email from launch (one more signup, fresh email) to confirm latest deploy didn't break anything.
- [ ] Stage all 10 outreach emails as drafts in Gmail (`hello@longrein.eu` from address). Don't send yet — Saturday morning.
- [ ] Set 09:00 Saturday alarm. Coffee. Then send the 10 emails one by one, taking 2 min between each to personalize.

Sleep well. The work is done.
