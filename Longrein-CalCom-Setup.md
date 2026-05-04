# Cal.com setup — `longrein.eu/demo`

**Public booking link for founding-member demo calls. Andreja runs once. ~15 min.**

---

## Why Cal.com (not Calendly, not Google Calendar appointment slots)

- Free tier sufficient for founding members (unlimited 1:1 bookings)
- Open-source, EU-based founders (alignment with Longrein's positioning)
- Native Google Calendar 2-way sync
- Auto-generates Zoom/Google Meet link per booking
- Slug we can self-host: `cal.com/longrein/demo` → redirected to `longrein.eu/demo`

---

## Step 1 — Sign up

1. Open `https://app.cal.com/signup`
2. **Sign in with Google** → use `longrein.team@gmail.com` (NOT personal iCloud) — same vendor pattern as Resend
3. Username: `longrein` (this becomes `cal.com/longrein/...`)
4. Welcome wizard — pick:
   - Time zone: Vilnius (Europe/Vilnius)
   - Working hours: Mon–Fri 09:00–17:00 (you can refine later)
   - Default event length: 45 min

---

## Step 2 — Connect Google Calendar

1. Settings → Calendars → **Connect new calendar** → Google Calendar
2. Authorise via the same `longrein.team@gmail.com` account
3. Make sure Cal.com sees:
   - Your calendar (writes new bookings here)
   - Bookings won't double-book against your existing Google Calendar events

---

## Step 3 — Connect Zoom (or use Google Meet)

**Option A — Zoom** (recommended if founding members are LT/PL — they often expect Zoom):
1. Settings → Apps → Zoom → Install
2. Authorise via Zoom OAuth (you'll need a Zoom account first; free Basic is fine)

**Option B — Google Meet** (faster, no extra account):
1. Already connected once Google Calendar is linked
2. Cal.com auto-generates a Meet link per booking

If unsure, pick Google Meet for speed. You can switch later.

---

## Step 4 — Create the "Founding Member Onboarding" event type

1. Event Types → New
2. Title: `Longrein Founding Member Onboarding`
3. URL slug: `demo` → final URL: `cal.com/longrein/demo`
4. Description (markdown OK, will show in the booking page):

```
A 45-minute call to set up your stable on Longrein.

We'll spend 15 minutes on how your stable runs today, 20 minutes setting up Longrein with your real data, and 10 minutes for your questions.

Book a Tuesday or Thursday afternoon if you can — that's when I have full focus on founding-member calls. If those don't work, any other slot is fine.

—
Andreja
Founder · Longrein
hello@longrein.eu
```

5. Length: **45 minutes**
6. Buffer time before: 0 min · after: 15 min (gives you breath between calls)
7. Minimum booking notice: 24 hours
8. Time zone: respect attendee's time zone (auto-detect from their browser)
9. Available days: Tue + Wed + Thu (block out Mondays + Fridays for product work + own yard)
10. Available hours: 13:00–17:00 Europe/Vilnius (post-lunch focus window)
11. Limit: max 2 bookings per day, max 6 per week (you onboard one per business day per the audit plan)

### Booking questions (collected before the call)

- **Stable name** (text, required)
- **Country** (single select: Lithuania, Latvia, Estonia, Poland, Germany, Czechia, Other)
- **Roughly how many horses?** (number, required)
- **Roughly how many active clients per week?** (number, required)
- **Anything specific you'd like Andreja to look at during the call?** (long text, optional)

These five answers go straight into your `Longrein-Founding-Members-Tracker.md` row when you log them after the call.

12. Save event type.

---

## Step 5 — Set up domain redirect: `longrein.eu/demo` → `cal.com/longrein/demo`

Two options depending on whether the apex landing is already deployed (see `Longrein-Apex-Landing-Deploy.md`):

### If apex landing IS deployed on Vercel:

Add a redirect in Vercel → `longrein-landing` project → Settings → Redirects:
- Source: `/demo`
- Destination: `https://cal.com/longrein/demo`
- Permanent (308): yes

Save. Test: `https://longrein.eu/demo` should redirect.

### If apex landing NOT yet deployed:

Add a `redirects` rule directly in Hostinger DNS panel:
1. Hostinger → Domains → longrein.eu → URL Forwarding
2. Source: `/demo`
3. Target: `https://cal.com/longrein/demo`
4. Type: 301 permanent
5. Save

Test: `https://longrein.eu/demo`

---

## Step 6 — Email + WhatsApp + LinkedIn ready-to-use links

Save these in your phone notes for quick share:

| Channel | Link |
|---|---|
| **Email signature** | `Book a 45-min Longrein demo: longrein.eu/demo` |
| **WhatsApp message** | `Hey, here's a slot picker for our Longrein onboarding call — pick whatever works: longrein.eu/demo` |
| **LinkedIn DM** | `If you'd rather just see it in 45 min: longrein.eu/demo` |
| **Outreach email body** | (already in `Longrein-Outreach-Email-Templates.md` — every template links here) |

---

## Step 7 — Test it yourself

1. Open `https://longrein.eu/demo` in incognito
2. Pick a slot in your test browser
3. Fill the 5 booking questions
4. Confirm
5. Check `longrein.team@gmail.com` Gmail — confirmation email should arrive
6. Check Google Calendar — event should appear with Zoom/Meet link
7. (Optional) Check Cal.com → Bookings → verify the booking record

If all of that works, you're live. Cancel the test booking after.

---

## Optional polish (do later)

- **Reminders**: Cal.com → Workflows → "1 hour before" + "24 hours before" SMS or email reminder. Use email-only initially (free); SMS in EU costs €0.05/booking.
- **Custom branding**: Cal.com → Appearance → upload Longrein logo (Saddle Tan SVG from `/APP/brand/`), set Paddock Green as primary colour. Premium feature on paid tier (€12/mo) — defer until customer #6 proves traction.
- **Auto-post calendar reminder to founding members WhatsApp group**: defer to month 2.

---

## What this is NOT

- Not a public "Book a Lesson" tool for stable customers — that's the in-app calendar, separate concern.
- Not a customer support scheduling tool — for that you respond on email.
- Not for board meetings or investor calls — different time-of-day window, those use Andreja's personal Google Calendar.

This is one event type, one URL, one purpose: book a 45-min Longrein onboarding for the next 10 founding-member stables. Keep it simple.
