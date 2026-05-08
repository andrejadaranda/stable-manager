# Longrein vendor accounts — master register (verified 2026-05-07)

**Šis failas yra single source of truth, koks email naudotas kuriam vendor'iui. Naudok kartu su Bitwarden'u — Bitwarden saugo password'us, šis failas saugo "kuris email kuriam vendor'iui" bei migration plan.**

> Atnaujink šitą failą kiekvieną kartą, kai sukuri/migruoji vendor account'ą. Push'ink į git — git history yra audit log'as.

---

## Status santrauka

| Kategorija | Vendor'iai | Status |
|---|---|---|
| **Production infra (kritinė)** | Vercel, Supabase, Hostinger | 🟡 Visi ant `darandaandreja@icloud.com` (Apple ID) — migruoti po M3 |
| **Communication** | Resend, Instagram | 🟢 Ant `longrein.team@gmail.com` (švarus) |
| **Identity (asmeninis)** | GitHub, LinkedIn, Anthropic | 🟢 Asmeniniame email'e (intencingas pasirinkimas) |
| **Dar nesukurta** | Cal.com, Stripe, banko sąskaita | 🔴 Sukurti su `longrein.team@gmail.com` |

---

## 1. Production infrastructure (BŪTINA hardenint, NE migruoti dabar)

### Vercel
- **Login email:** `darandaandreja@icloud.com`
- **URL:** vercel.com/dashboard
- **Veikimas:** Hostina `app.longrein.eu` (Next.js app) ir `longrein.eu` (landing — kai apex deploy'as bus padarytas)
- **2FA:** ❓ patikrink Settings → Authentication → Two-Factor
- **Backup codes:** ❓ jeigu 2FA įjungta — saugoti Bitwarden Secure Note
- **Migration target:** longrein.team@gmail.com — po M3 (rugpjūtis 2026)
- **Migration metodas:** Vercel → Settings → Members → Invite longrein.team@... → Make owner → leave personal account

### Supabase
- **Login email:** `darandaandreja@icloud.com`
- **URL:** supabase.com/dashboard
- **Project name:** "Horse managment app" (sic — su typo)
- **Project ID:** dluxzjphpokzkrwmmibe
- **Region:** EU-Ireland
- **Veikimas:** Production database, Auth, Storage
- **2FA:** ❓ patikrink Account → Multi-Factor
- **Migration target:** longrein.team@gmail.com — po M3
- **Migration metodas:** Supabase → Settings → Team → Invite longrein.team → Owner → leave personal
- **Atskira nota:** SUPABASE_SERVICE_ROLE_KEY yra pavojingas — gali ištrinti viską. Saugoti tik Bitwarden, niekada ne git, niekada ne email'e.

### Hostinger
- **Login email:** `darandaandreja@icloud.com`
- **URL:** hpanel.hostinger.com
- **Veikimas:** Domain registrar — `longrein.eu` + DNS
- **2FA:** ❓ patikrink Profile → Security
- **Migration target:** longrein.team@gmail.com — pirmą savaitę po launch'o
- **Migration metodas:** Hostinger → Profile → Change account email; reikės email verifikacijos abu pusėse
- **DNS records faktiniai (žinotini):**
  - `app.longrein.eu` → Vercel (CNAME)
  - `longrein.eu` apex → Vercel (A) — kai apex landing bus deploy'inta
  - MX rekordai → Google (kad longrein.team@gmail veiktų)
  - DKIM/SPF/DMARC → Resend (email DNS auth, jau veikia)

---

## 2. Communication (ŠVARŪS — ant longrein.team@gmail.com)

### Resend
- **Login email:** `longrein.team@gmail.com` ✓
- **URL:** resend.com
- **Plan:** Free (3000 emails/mėn, 100/dieną)
- **Used:** 1/3000 (per testus)
- **Veikimas:** SMTP per Supabase (transactional emails — welcome, reset, magic link, invite, lesson reminder)
- **2FA:** ❓ patikrink Settings → Security
- **API key:** SMTP key generated (Settings → API Keys). Aktualus key saugomas Supabase → Auth → SMTP settings.
- **Domain auth:** longrein.eu DKIM/SPF/DMARC — **all green** (verified 2026-05-03)

### Instagram @longreinapp
- **Login email:** `longrein.team@gmail.com` ✓
- **URL:** instagram.com/longreinapp
- **Veikimas:** Public marketing (Vilnius launch posts, tasking 2k followers M1)
- **Connected:** Facebook page Longrein
- **2FA:** ❓ Instagram → Settings → Security → 2FA — turi būti TOTP, ne SMS
- **Recovery codes:** ❓ saugoti Bitwarden

---

## 3. Identity (asmeniniai — pasilieka)

### GitHub `andrejadaranda`
- **Login email:** asmeninis (Andreja's personal GitHub)
- **Repo:** github.com/andrejadaranda/stable-manager.git (TBD pervadinti į `longrein` po launch'o)
- **2FA:** ❓ patikrink Settings → Password and authentication
- **Future:** sukurti GitHub Organization "longrein", transfer repo (po M3)
- **SSH keys / PATs:** ❓ saugoti Bitwarden, regeneruoti naujam Mac'ui

### LinkedIn (Andreja Adaranda)
- **Login email:** asmeninis
- **Veikimas:** Asmeninis profilis. Longrein company page valdoma per šitą profilį (tu = company admin).
- **2FA:** ❓ patikrink Settings → Sign in & security

### Anthropic / Claude.ai
- **Login email:** `ad@archiprod.eu`
- **Veikimas:** Pro license — naudoja Cowork app'ą + tau šnekant su manim
- **2FA:** ❓ patikrink

### Apple ID (KRITINIS — recovery for everything)
- **ID:** `darandaandreja@icloud.com`
- **Linked devices:** ❓ patikrink (System Settings → Apple ID → Devices) ir pašalink senus
- **2FA:** ✓ privaloma Apple
- **Recovery key:** ❓ ar sukurta? Jei ne — sukurti ŠIANDIEN, atspausdinti, padėti namų seife
- **Trusted phone numbers:** ❓ patikrink, kad telefonas teisingas
- **Recovery email:** turi būti `longrein.team@gmail.com`

---

## 4. Dar nesukurta — sukurti su longrein.team@gmail.com

### Cal.com / Cal.eu ✅ DONE (2026-05-08)
- **Login email:** `longrein.team@gmail.com` ✓
- **Data region:** European Union (cal.eu domain — GDPR compliant)
- **Public URL:** `cal.eu/longrein/demo`
- **Brand redirect:** `longrein.eu/demo` → `cal.eu/longrein/demo` (Next.js + Vercel `landing/vercel.json` redirects, 308 permanent)
- **Active event:** "Founding member demo" (30 min, Cal Video, Europe/Vilnius, M-F 9-17)
- **Hidden events:** Secret meeting + 15 min meeting (default events disabled)
- **Calendar connected:** Google Calendar (longrein.team@gmail.com) — read+write
- **2FA:** ❓ TODO post-launch — Cal.com → Settings → Security
- **Plan:** Free (sufficient for solo founder; Pro €12/mo unlocks team + custom domains if needed M3+)

### Stripe
- **Login email (bus):** `longrein.team@gmail.com`
- **Reikia iki:** M9 (2027 sausis), kai pradėsi imti €30/mo iš founding members
- **Sietina su:** verslo banko sąskaita (žemiau)

### Verslo banko sąskaita (LT)
- **Reikia iki:** M9 prieš Stripe activation
- **Setup playbook:** `Longrein-LT-Business-Registration-2026-05-02.md` (Longrein-Ops/)
- **Kandidatai:** Revolut Business / Wise / SEB Verslo / Swedbank Verslo

---

## 5. Bitwarden vault setup (target struktūra)

Sukurk šiuos folder'ius Bitwarden'e:

```
Longrein/
├── Production-Infra/
│   ├── Vercel (logins + 2FA backup codes)
│   ├── Supabase (logins + 2FA + service role key)
│   └── Hostinger (logins + 2FA + DNS access)
├── Communication/
│   ├── Resend (logins + 2FA + SMTP API key)
│   └── Instagram @longreinapp (logins + 2FA codes)
├── Identity/
│   ├── GitHub (login + 2FA + SSH key passphrase)
│   ├── LinkedIn (login)
│   └── Apple ID darandaandreja (2FA + recovery key + recovery email)
├── Secrets/
│   ├── Longrein .env.local Production (3 SUPABASE_* values)
│   ├── Resend SMTP password (separate from Resend account password)
│   └── Cal.com credentials (kai sukursi)
└── Future/
    ├── Stripe (kai sukursi M9)
    └── Banko sąskaita (kai atidarysi)
```

---

## 6. Pre-launch security checklist (4 dienos iki 2026-05-23)

- [ ] Apple ID `darandaandreja@icloud.com` — 2FA + recovery key + atspausdinta
- [ ] Vercel — 2FA įjungta, backup codes Bitwarden'e
- [ ] Supabase — 2FA įjungta, backup codes Bitwarden'e
- [ ] Hostinger — 2FA įjungta, backup codes Bitwarden'e
- [ ] Resend — 2FA įjungta, backup codes Bitwarden'e
- [ ] GitHub — 2FA įjungta (TOTP, ne SMS)
- [ ] Instagram @longreinapp — 2FA TOTP, ne SMS
- [ ] LinkedIn — 2FA įjungta
- [ ] Bitwarden master password — stiprus (16+ char), niekur nepasidalintas
- [ ] Bitwarden 2FA — įjungta (Authenticator app)
- [ ] `.env.local` — backup'as Bitwarden Secure Note'e

**Be šito launch'as = vienas iCloud password'as = visa Longrein infra.**

---

## 7. Audit log — kada paskutinį kartą tikrinta

| Data | Kas tikrino | Findings |
|---|---|---|
| 2026-05-07 | Andreja + Claude | Resend = longrein.team ✓; Vercel/Supabase/Hostinger = darandaandreja@icloud.com (planuoti migraciją po M3); Cal.com nesukurta; Bitwarden įdiegtas |
| TBD (2026-05-22) | Andreja prieš launch'ą | Visi 2FA įjungti? |
| TBD (2026-08) | Andreja po M3 | Vercel + Supabase + Hostinger migration į longrein.team |
| TBD (2027-01) | Andreja prieš M9 | Stripe + verslo bankas sukurta |

---

— Atnaujinta: 2026-05-07 — Andreja
