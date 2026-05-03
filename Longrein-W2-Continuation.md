# Sav. 2 — likę punktai (po DNS propagacijos)

**Data:** 2026-05-03 popietė. DNS just-set, propagacija vyksta (5–30 min).

---

## ✅ Šiandien padaryta (W2 dalis 1)

1. Nupirkta `longrein.eu` (Hostinger)
2. Pridėtas CNAME `app` → `cname.vercel-dns.com` (Hostinger DNS)
3. Pridėtas `app.longrein.eu` kaip custom domain Vercel'io `stable-manager` projekte (SSL automatic)
4. Supabase Auth Site URL → `https://app.longrein.eu`
5. Supabase Redirect URL → `https://app.longrein.eu/**`
6. Resend account sukurtas (login: `longrein.team@gmail.com` per Google SSO, region `Ireland (eu-west-1)`)
7. Resend domain `longrein.eu` pridėtas
8. Hostinger pridėti 4 DNS records'ai:
   - TXT `resend._domainkey` (DKIM)
   - TXT `send` (SPF: `v=spf1 include:amazonses.com ~all`)
   - MX `send` (10, `feedback-smtp.eu-west-1.amazonses.com`)
   - TXT `_dmarc` (`v=DMARC1; p=none;`)
9. Sukurti **5 brand-voice email templates** (`Longrein-Email-Templates.md`)
10. Sukurtas **`MOBILE_FRICTIONS.md`** dogfood'ui
11. Paruoštas `landing/index.html` (kopija iš Longrein-Waitlist-Landing.html — sav. 2 deploy'inimui)

---

## ⏳ Likę punktai (~30 min darbo, kai DNS propagacija įvyks)

### Punktas A — Patikrinti `app.longrein.eu`

1. Atidaryk inkognito tab'e: `https://app.longrein.eu`
2. Tikrintinos sąlygos:
   - HTTPS spynele rodoma (Vercel SSL)
   - Atidaro Longrein login puslapį
   - Cookie banner pasirodo apačioje kairėje
   - Footer turi link'us į `/legal/terms /legal/privacy /legal/cookies`

Jeigu rodo 404 / SSL error → DNS dar plinta. Palaukti 10 min ir bandyti vėl.

### Punktas B — Verify Resend domain

1. `https://resend.com/domains/longrein.eu`
2. Spaudžiame **Verify DNS Records**
3. Tikslas: visi 3 sluoksniai (DKIM, SPF, DMARC) ir MX rodo zalią žymę „Verified"
4. Status'as turi pakeisti į „**Verified**" (vietoj „Not Started")

Jei vis dar „Not Started" po 30 min:
- Patikrinti Hostinger DNS lentelėje, ar visi 4 records'ai vis dar matomi (kartais Hostinger silently rejected ilgus DKIM key'us)
- Run `dig TXT resend._domainkey.longrein.eu @8.8.8.8` (per terminal) — turi grąžinti DKIM `p=...` reikšmę

### Punktas C — Supabase SMTP setup

1. Resend → API Keys → **Create API Key**:
   - Name: `Supabase SMTP — Longrein production`
   - Permission: **Sending access** (NE Full access — least privilege)
   - Domain: `longrein.eu`
   - Sukopijuok API key'ą (rodomas tik vieną kartą — saugok)

2. Supabase Dashboard → Project Settings → Authentication → SMTP Settings:
   - **Enable Custom SMTP** ✅
   - Sender email: `hello@longrein.eu`
   - Sender name: `Longrein`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: paste'ink Resend API key'ą
   - Save

3. Supabase Dashboard → Authentication → Email Templates:
   - **Confirm signup** → paste HTML iš `Longrein-Email-Templates.md` skyriaus 1
   - **Magic Link** → skyrius 3
   - **Reset Password** → skyrius 2
   - **Invite User** → skyrius 4
   - Subject lines pakeisti per kiekvieną
   - **Save** kiekvienoje

### Punktas D — End-to-end test

1. Atidaryk inkognito → `https://app.longrein.eu/signup`
2. Įvesk testinį email (pvz., savo iCloud `darandaandreja@icloud.com`)
3. Sukurk testinį stable
4. Per ~30 sek turėtų ateiti welcome email iš `hello@longrein.eu`
5. Tikrintinos sąlygos:
   - From: `Longrein <hello@longrein.eu>`
   - Subject: `Welcome to Longrein. Confirm your email.`
   - Body: Paddock Green wordmark, Confirm button → veda į teisingą URL ant app.longrein.eu
   - Spam folder'yje? Jei taip — tikriausia DKIM ar SPF dar nepraleido. Run domain check at https://www.mail-tester.com/

### Punktas E — Landing puslapio deploy ant apex (longrein.eu)

**Strategija:** atskiras Vercel projektas, host'inantis `landing/index.html` kaip statinį site'ą.

1. Vercel Dashboard → New Project → Import GitHub repo (tas pats `stable-manager`)
2. Project name: `longrein-landing`
3. Framework preset: **Other** (statinis)
4. Root directory: `landing` (tai kur `index.html` gyvena)
5. Build command: tuščia
6. Output directory: `.` (root)
7. Deploy

Po deploy'o:

8. Šio naujo projekto Settings → Domains:
   - Add `longrein.eu` (apex)
   - Add `www.longrein.eu`

9. **Hostinger DNS pakeitimai** (apex perdarymas):
   - **Ištrinti** `A @ → 2.57.91.91` (parking page)
   - **Pridėti** `A @ → 76.76.21.21` (Vercel apex IP)
   - **Pakeisti** CNAME `www → longrein.eu` į CNAME `www → cname.vercel-dns.com`

10. Wait 5–15 min DNS propagacijai
11. Atidaryk `https://longrein.eu` → turi rodyti landing su Longrein wordmark + waitlist forma

**SVARBU:** waitlist forma `landing/index.html` faile fetch'ina `/api/waitlist` (relative URL). Šitas neveiks ant `longrein.eu` apex (atskiras projektas). Reikia pakeisti `landing/index.html` kode form action'ą:

```js
// Pakeisti šią eilutę landing/index.html ~480 line:
fetch("/api/waitlist", {
// Į:
fetch("https://app.longrein.eu/api/waitlist", {
```

Plus reikia įgalinti CORS Next.js'o `/api/waitlist` route'e — pridėti `Access-Control-Allow-Origin: https://longrein.eu` header'į. Pranešk man, kai atvyks šis žingsnis — pakeisiu kodą ir push'insiu.

---

## 🟦 Po šios sesijos — Sav. 2 likusi savaitė

| Diena | Darbas |
|---|---|
| Pir 12 → Sek 18 | Mobile dogfood (`MOBILE_FRICTIONS.md`) |
| Pir 12 (1 val) | Užbaikim Resend + email templates apply'inimą (kai DNS) |
| Tre 14 (2 val) | Landing deploy'as ant apex |
| Šeš 16 | Sav. 2 review — paruošimas Sav. 3 |

## 🟩 Sav. 3 (19–22 gegužės)

- Top 5 mobile frictions iš `MOBILE_FRICTIONS.md`
- E2E fresh-account test (<30 min)
- Founding Members onboarding script + outreach templates (atskiras file)
- Cal.com setup ant `longrein.eu/demo`
- Final smoke test
- **LAUNCH DAY: Šeštadienis 2026-05-23** — siunti 10 personalizuotus email'us

---

**Dabar svarbiausia:** dogfood'inti telefone visą savaitę. Kiekvienas friction, kurį pati pamatai, yra friction, kurio neprajuoks tavo first paying customer.
