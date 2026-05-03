# Longrein Ops — START HERE

**Tikslas:** Per 30 min sutvarkyti longrein.team@gmail.com paskyrą taip, kad ji būtų visos įmonės operacinis centras — Drive, password manager, social media, vendor account'ai. Be šito setup'o pirmoji rimta klaida (pamirštas slaptažodis, prarastas telefonas, hijack'inta paskyra) sustabdys visą biznį.

**Dabar paskyra sukurta. Liko 4 žingsniai.**

---

## ŽINGSNIS 1 — Saugumas (10 min, KRITINIS)

Be šito viskas kita beprasmiška.

- [ ] **2FA įjungtas per Authenticator app** (NE SMS — SMS yra hijack'inami)
  - Gmail → Manage your Google Account → Security → 2-Step Verification
  - Pasirink „Authenticator app" → naudok Google Authenticator (iOS/Android) arba 1Password TOTP
  - **NEpalik tik „Voice or text message" — tai nesaugu**
- [ ] **8 backup codes atsispausdinti ir laikomi fizinėje vietoje**
  - Print → įdėti į voką → laikyti seife arba sutarties popierių aplanke
  - **NESLINGUOJ jų į Drive ar į asmeninį email** — tai pažeidžia visą saugumo logiką
- [x] **Recovery email = darandaandreja@icloud.com** (tavo asmeninis iCloud) ✓ patvirtinta
- [ ] **Recovery telefonas = tavo asmeninis numeris** (jei dar nepridėta)
- [ ] **Trusted devices** — pasirink „Yes, I trust this device" tik savo asmeniniame Mac'e ir telefone, niekur kitur

---

## ŽINGSNIS 2 — Password Manager setup (10 min, KRITINIS)

longrein.team@gmail.com paskyros slaptažodis turi būti saugomas vienoje patikimoje vietoje, ne tavo galvoje, ne text'iniame faile.

**Rekomendacija — Bitwarden free tier** (bitwarden.com)

- [ ] Sukurti Bitwarden paskyrą su tavo asmeniniu email'u (NE longrein.team@gmail.com — Bitwarden YRA tavo „raktinis" identitetas, jis turi būti atskirtas)
- [ ] Master Password: **20+ simbolių, paranoidiškai ilgas, pasižymėk fiziškai vieną kartą, daugiau niekur** (jei prarasi — visi tavo slaptažodžiai prarasti, niekas tau jų neatkurs)
- [ ] Įjunk 2FA Bitwarden'e (per Authenticator app, irgi NE SMS)
- [ ] Pirmas įrašas Bitwarden'e:
  - Title: „Longrein Team Gmail"
  - URL: https://accounts.google.com
  - Username: longrein.team@gmail.com
  - Password: tavo Gmail paskyros slaptažodis
  - Notes: „Recovery email: ad@archiprod.eu | Recovery phone: tavo numeris | Backup codes: SEIF (printed)"

**Alternatyvos jei nepatinka Bitwarden:**
- 1Password ($3/mėn) — premium UX, geriausia mobile aplikacija
- Apple Keychain — free, bet užrakinti į Apple ekosistemą (jei kada nors persiskirti į Android'ą — problema)

---

## ŽINGSNIS 3 — Drive folder struktūra (5 min)

Atidaryk drive.google.com (turi būti loginta į longrein.team@gmail.com). Sukurk šiuos 8 top-level folder'ius **lygiai šiuo pavadinimu** (numeriai svarbūs — jie verčia natūralią eilę):

```
00_Brand
01_Legal
02_Product
03_Customers
04_Marketing
05_Finance
06_Ops
07_Photos
```

Kiekvieno folder'io paskirtis (pažymėsim README failais kitam žingsnyje):

| Folder'is | Kas saugoma |
|---|---|
| 00_Brand | Logo failai, brand book PDF, color palette, font failai, brand voice guide, tagline'ai |
| 01_Legal | Trademark dokumentai (EUIPO/LT), ToS, Privacy Policy, Cookie Policy, DPA šablonai, vendor sutartys |
| 02_Product | Audit'ai, roadmap'as, product backlog, screenshots, demo video'ai, app docs |
| 03_Customers | CRM (founding members tracker), demo notes, kontraktai, case study'ai, atsiliepimai |
| 04_Marketing | Social media post'ai (paruošti + suplanuoti), email kampanijos, copy archive, landing screenshots |
| 05_Finance | Sąskaitos (gautos + išrašytos), mokesčiai, P&L, banko statements, vendor invoices |
| 06_Ops | Vendor accounts tracker, DNS records, password vault back'apas, SOP'ai, procesai |
| 07_Photos | Žirgyno fotografijos, product screenshots, paruošti social media vizualai |

**Sub-folder'ius kursime po reikalo, ne dabar. Pradėk su 8 top-level.**

---

## ŽINGSNIS 4 — Pirmieji failai į Drive (15 min)

Iš tavo APP folder'io į Drive įkelk šituos failus DABAR (kiti — palaipsniui):

**Į 00_Brand:**
- Hoofbeat-Brand-Foundation.docx (rytoj atnaujinsim į Longrein)
- Hoofbeat-Brand-Preview.html (rytoj atnaujinsim)

**Į 02_Product:**
- Hoofbeat-Audit-2026-04-30.md
- Longrein-Readiness-Audit-2026-05-02.md
- Hoofbeat-Launch-Playbook-v1.docx (rytoj atnaujinsim)
- MASTER.md, MASTER_PLAN.md, PRODUCT_BACKLOG.md, NEXT_STEPS.md
- LAUNCH_PLAN.md, HORSE_PROFILE_DESIGN.md, RLS_TEST_PLAN.md
- INTEGRATION_NOTES.md
- Stable-OS-Business-Plan.docx (verslo planas — žinota, kad pavadinimas senas)

**Į 04_Marketing:**
- LANDING_COPY.md
- IG_OUTREACH.md
- TARGET_LIST_GUIDE.md
- BRAND_NAMES.md
- Hoofbeat-Waitlist-Landing.html (rytoj atnaujinsim)

**Į 06_Ops:**
- Šis START-HERE.md failas
- (Vėliau — Vendor Accounts Tracker, Password Hygiene Playbook iš šio folder'io)

**KAIP įkelti:** Mac'e, atidaryk Finder → eik į /Users/andrejadaranda/Documents/Claude/Projects/APP. Atidaryk Drive naršyklėje. Drag-and-drop failus tiesiai iš Finder'io į Drive'o folder'į.

---

## ŽINGSNIS 5 — Kai šie 4 žingsniai padaryti

Atsiusk man patvirtinimą („done" pakanka). Tada:

1. Aš ruošiu **Vendor Accounts Tracker** (.xlsx) — sąrašas visų vendor'ių (Hostinger, Resend, Stripe, Vercel, Cal.com, Notion, Bitwarden, Cloudflare ir t.t.) su account email, plan'u, mėnesine kaina, atnaujinimo data, paskutinio prisijungimo data
2. Aš ruošiu **Password Hygiene Playbook** (.md) — kaip rotinti, kas turi prieigą, ką daryti, jei prarastas telefonas
3. Aš ruošiu **Brand Email Roadmap** (.md) — kada ir kaip pereiti nuo longrein.team@gmail.com į andreja@longrein.eu (Workspace setup)
4. Pradedam social media account'ų kūrimą (IG, LinkedIn, YouTube — visi prijungti prie longrein.team@gmail.com kaip recovery)

---

## Saugumo taisyklės, kurias įsidedi į galvą NUO ŠIANDIEN

1. **NIEKADA** nesidalink longrein.team@gmail.com slaptažodžiu chat'e, email'e, screenshot'e
2. **NIEKADA** nelauk „prisijungimo per Google" iš atsitiktinių svetainių į longrein.team@gmail.com — naudok tik žinomus vendor'ius
3. **VISADA** išvalyk session'ą („Sign out from all devices") jei kartą abejoji
4. **KAS 6 mėn.** rotinkk Gmail master slaptažodį (Bitwarden tau primins)
5. **NIEKADA** neleisi browser'iui įsiminti šio slaptažodžio — tik per Bitwarden auto-fill
6. **JEI prarasi telefoną** — pirmiausia naudok backup codes Gmail prisijungimui, paskui Bitwarden master password'u atrakinti vault'ą, paskui pridėti naują telefono Authenticator

Šitos 6 taisyklės skiria „lengva atsigauti" nuo „prarasti įmonę".
