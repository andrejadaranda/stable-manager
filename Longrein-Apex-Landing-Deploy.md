# Apex landing deployment — `longrein.eu`

**Step-by-step instructions to deploy `Longrein-Waitlist-Landing.html` on `longrein.eu` (apex) as a separate Vercel project. ~30 min total. Andreja runs.**

---

## Why a separate project (not extend the Next.js app)

- Apex (`longrein.eu`) and app subdomain (`app.longrein.eu`) serve different audiences. Marketing landing for prospects; Next.js app for logged-in customers.
- Separate Vercel project = independent deploy, no risk of breaking the app when iterating on landing copy.
- Static HTML deploy is instant — no build, no Next.js, no surprises.
- Drawback: waitlist form will need its endpoint changed from relative `/api/waitlist` to absolute `https://app.longrein.eu/api/waitlist`. Step 5 below covers this.

---

## Step 1 — Vercel: create new project

1. Open `https://vercel.com/new`
2. Click **Import Git Repository**
3. Pick the `stable-manager` repo (the same repo as the existing app)
4. Project name: `longrein-landing`
5. Framework preset: **Other** (NOT Next.js)
6. **Root Directory**: click Edit → set to `landing` (this is the `landing/` folder we created in May 3 commit)
7. Build Command: leave EMPTY
8. Output Directory: `.` (just a dot, root of the `landing/` folder)
9. Install Command: leave EMPTY
10. Click **Deploy**

Vercel will deploy `landing/index.html` as a static page. Default URL will be something like `longrein-landing-xyz.vercel.app`. Visit it to confirm the landing renders.

---

## Step 2 — Vercel: add custom domains

In the new `longrein-landing` project:

1. Settings → Domains
2. Click **Add**
3. Enter `longrein.eu` → Add
4. Click **Add** again
5. Enter `www.longrein.eu` → Add → choose "Redirect to longrein.eu"

Vercel will show DNS instructions. Note the values it asks for (typically: `A` record at `76.76.21.21` and a CNAME for `www`).

---

## Step 3 — Hostinger: update DNS for apex

Open Hostinger DNS panel: `https://hpanel.hostinger.com/domain/longrein.eu/dns?tab=dns_records`

**Existing records to keep:**
- `CNAME app → cname.vercel-dns.com` ← Already there from May 3, points app subdomain to Next.js app. KEEP.
- All 4 Resend records (TXT resend._domainkey, TXT send, MX send, TXT _dmarc) ← KEEP, these power email.

**Records to UPDATE:**
- **Existing `A @ → 2.57.91.91` (Hostinger parking page)** → **EDIT** → change content to `76.76.21.21`. Save.
- **Existing `CNAME www → longrein.eu`** → **EDIT** → change content to `cname.vercel-dns.com`. Save.

(If Hostinger shows an option to "delete + re-add" instead of edit, do delete + add.)

After save, DNS propagates within 5–30 min. Vercel will show "Pending" → "Valid" status.

---

## Step 4 — Verify

After 15 min:
1. Open incognito Chrome → `https://longrein.eu`
2. Should show the Longrein waitlist landing (cream background, Paddock Green sections, "Run the yard. Protect the horses.")
3. Should have HTTPS lock (Vercel auto-issues SSL)
4. Open `https://www.longrein.eu` → should redirect to `https://longrein.eu`

If still showing Hostinger parking page after 30 min, run `dig longrein.eu @8.8.8.8` from Terminal — should resolve to a Vercel IP.

---

## Step 5 — Wire the waitlist form to the app's API

The landing form currently uses relative URL `/api/waitlist` which won't work on apex (different domain). Two options:

### Option A (recommended): Update landing/index.html, redeploy

1. Open `landing/index.html` in any text editor
2. Find the line (around line 477):
   ```js
   fetch("/api/waitlist", {
   ```
3. Change to:
   ```js
   fetch("https://app.longrein.eu/api/waitlist", {
   ```
4. Save the file
5. Commit + push:
   ```bash
   cd ~/Documents/Claude/Projects/APP
   git add landing/index.html
   git commit -m "Apex landing: point waitlist form to app subdomain API"
   git push origin main
   ```
6. Vercel will auto-redeploy the `longrein-landing` project (~60s)

### Option B: Have Claude do this

After domain DNS is verified live, message Claude with: "Update landing form fetch URL to app.longrein.eu and push" and it will do the edit + push.

---

## Step 6 — Add CORS to /api/waitlist (Next.js app)

Once the form is fetching cross-origin (from `longrein.eu` to `app.longrein.eu`), the Next.js API route needs to allow it. Open `app/api/waitlist/route.ts` and add CORS headers:

```typescript
// Add these to both responses (success and error)
return NextResponse.json({ ok: true }, {
  headers: {
    "Access-Control-Allow-Origin": "https://longrein.eu",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  },
});

// And add an OPTIONS handler at the bottom of the file:
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://longrein.eu",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
```

**Have Claude do this** (it's a quick Edit + push). Just message: "Add CORS to /api/waitlist for longrein.eu" and Claude handles it.

---

## Step 7 — Final smoke test (after both projects deployed)

1. Open incognito → `https://longrein.eu`
2. Scroll to waitlist form (hero section or footer)
3. Type a fresh email (e.g., `darandaandreja+landing-test@gmail.com`)
4. Submit
5. Form should show "Thanks. You'll hear from us soon." (or whatever the success copy is)
6. Verify in Supabase: open Supabase Dashboard → Table Editor → `waitlist_signups` → row with that email should exist
7. (Optional) Verify Resend → Logs → if you set up a welcome-to-waitlist email later, it should appear here

---

## What this DOESN'T do (deferred)

- Public Cal.com link at `longrein.eu/demo` — separate W3 task
- Localised landing variants (LT, PL, DE) — Phase 2, Q3'26+
- Marketing analytics on the landing — defer until first 50 customers
- `longrein.eu/blog` or other content paths — Phase 3+

---

## Time estimate

- Step 1 (new Vercel project): 5 min
- Step 2 (add domains): 2 min
- Step 3 (Hostinger DNS swap): 5 min
- DNS propagation wait: 5–30 min (background)
- Step 4 (verify): 1 min
- Step 5 (form fetch URL): 2 min if Claude does it, 10 min manual
- Step 6 (CORS): 2 min if Claude does it
- Step 7 (smoke test): 3 min

**Total active work: ~25 min. Total wall time including DNS propagation: ~45 min.**

Best done Tuesday or Wednesday afternoon when Andreja can babysit DNS without distractions.
