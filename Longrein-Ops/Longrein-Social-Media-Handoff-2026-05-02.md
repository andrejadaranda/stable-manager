# Longrein Social Media — Status & Handoff

**Data:** 2026-05-02
**Locked handle visur:** `@longreinapp`
**Brand assets:** `/APP/brand/logo/png/` (icon-1024x1024.png profile, wordmark-3040x720.png cover)

---

## Status — kas LIVE

| Platforma | Account | Status | Public URL |
|---|---|---|---|
| Instagram | @longreinapp | ✅ LIVE — bio + placeholder L. profile photo | instagram.com/longreinapp |
| LinkedIn | Longrein Company Page | ✅ LIVE — tagline, industry, no logo | linkedin.com/company/longrein |
| YouTube | @longreinapp Brand Account | ✅ LIVE — name + handle, no banner/avatar | youtube.com/@longreinapp |
| Facebook | Longrein Page | ✅ LIVE — bio + category, no profile/cover | facebook.com/profile.php?id=61589438210872 |
| TikTok | @longreinapp | ✅ RESERVED — Google OAuth signup, no profile customization | tiktok.com/@longreinapp |
| X / Twitter | @longreinapp | ⏳ TU — Chrome MCP popup blocker neleido OAuth | (not created yet — see below) |

---

## TAU dar padaryti šią savaitę

### 1. Instagram (mobile-only — telefono app'e, 5 min)
- [ ] **Replace profile photo** su tikrąja `icon-1024x1024.png` iš `/APP/brand/logo/png/` (dabar tik mano placeholder „L." veikia, bet nauja icon su Saddle Tan tašku ir Cream „L." stilingesnė)
- [ ] **Add link** — Edit profile → Add link → URL: `https://longrein.eu`
- [ ] **Switch to Business profile** — Settings → Account type → Switch to professional → Business → Category „Software Company"

### 2. LinkedIn Company Page (web, 3 min)
- [ ] **Logo** — Edit Page → Logo → upload `icon-1024x1024.png`
- [ ] **Cover image** — Edit Page → Cover image → upload `wordmark-3040x720.png`
- [ ] **About section** — Add „About us" section with longer description (300–500 chars), specialties (stable management, equestrian, SaaS, GDPR, SEPA), founded year (2026), location (Lithuania), website link

### 3. YouTube channel (web, 3 min)
- [ ] **Profile picture** — Customize channel → Branding → Picture → upload `icon-1024x1024.png`
- [ ] **Banner image** — Customize channel → Branding → Banner image → upload `wordmark-3040x720.png` (YouTube'as crop'ins į 2560x1440, tinka)
- [ ] **Description** — Customize channel → Basic info → Description → tas pats kas IG bio + 1-2 sakiniai apie kanalą (kaip „Long-form videos about running stables in Europe")

### 4. Facebook Page (web, 3 min)
- [ ] **Profile picture** — Edit Page → upload `icon-1024x1024.png`
- [ ] **Cover photo** — Edit Page → upload `wordmark-3040x720.png` (FB cover ratio 16:9)

### 5. TikTok (mobile arba web, 5 min)
- [ ] **Profile picture** — upload `icon-1024x1024.png`
- [ ] **Bio** — paste:
  ```
  Stable management built in Europe.
  Run the yard. Protect the horses.
  Riding schools · livery yards · private stables
  longrein.eu
  ```
- [ ] **Category** — Software / SaaS

### 6. X / Twitter (web, 5 min — manualiai dėl Chrome MCP popup blocker'io)
- [ ] Eik į: `https://x.com/i/flow/signup`
- [ ] Spaudi „Sign up with Google" → Google popup atsidarys → pasirink **longrein.team@gmail.com**
- [ ] Username: **longreinapp** (jei pasiūlys kitokį, override)
- [ ] Po sukūrimo:
  - Profile picture: `icon-1024x1024.png`
  - Header (banner): `wordmark-3040x720.png`
  - Bio (160 chars max): `Stable management built in Europe. Run the yard. Protect the horses. Riding schools, livery yards, private stables.` (115 chars)
  - Website: `longrein.eu`
  - Location: `Lithuania`

---

## Bendros taisyklės VISIEMS social media

### Profile pictures
- Visur naudoti `/APP/brand/logo/png/icon-1024x1024.png` — Cream „L." + Saddle Tan dot ant Paddock Green rounded square
- Recognizable iki 32px feed view, premium signal

### Cover / banner / header images
- Visur naudoti `/APP/brand/logo/png/wordmark-3040x720.png` — Cream „Longrein." wordmark ant Paddock Green
- Aspect 4:1 — tinka LinkedIn (4:1), Facebook (16:9 — bus crop apačioj), YouTube (banner 16:9), X (header 3:1)
- Kiekvienoje platformoje preview prieš save, kad text'as nelūžtų ant safe zones

### Bio formatu
- Maximum 150 chars (IG limit)
- Tagline pirmas
- Pozicionavimas antras
- Audience trečias
- Link paskutinis
- Forbidden words: passion, journey, vision, soulful, hooved heroes, all-in-one, comprehensive platform

### Recovery checks po setup'o
- Visi 5 platformose recovery email = `longrein.team@gmail.com`
- Visi su 2FA įjungta (Authenticator app, NE SMS)
- Visi išsaugoti Bitwarden vault'e (kai bus setup'ed)

---

## Decision log

| 2026-05-02 | Pasirinktas handle: @longreinapp visur (vs @longrein.eu su tašku) | Cross-platform consistency wins over .eu domain mirror — dot fails on X/YT/LinkedIn/FB |
| 2026-05-02 | Profile pic: icon (L.) | Wordmark badly cropped in circle at small sizes |
| 2026-05-02 | Cover: wordmark | Wordmark perfect for 4:1 horizontal banner space |
| 2026-05-02 | TikTok + X aktyvuoti DABAR (vs reserve only iki Month 6) | Reservation now prevents squatters; activity remains paused per strategy |

---

## Kitas žingsnis (ne šios sesijos)

Kai visi logo'ai uploadinti ir X account'as sukurtas:
- Pradedam content roadmap'ą iki M1 follower target'o (2k @longreinapp)
- Pirmų 14 dienų turinio kalendarius (per Longrein-Launch-Playbook-v1.docx skyrių 6.4)
- Brand'inio email'o (Resend) setup per Sav. 2 sprint'o
