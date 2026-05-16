# Migration checklist — pereinant į naują kompiuterį

**Sukurta 2026-05-07. Tikslas: visas Longrein turtas (kodas, dokumentai, brand assets, slaptažodžiai) perkeltas į `longrein.team@gmail.com` Drive ir pasiekiamas iš naujo kompiuterio. Po šio sąrašo užbaigimo seną kompiuterį galima išjungti, neprarasti nieko.**

> Šis dokumentas yra tavo single source of truth migracijai. Atspausdink. Tikrink kiekvieną eilutę. Nepamiršk nieko.

---

## 0. Status overview (užpildyk šiandien)

- [ ] GitHub repo: visas kodas push'intas (žr. žemiau Sekcija 1)
- [ ] Lokalūs dokumentai (.md, .docx, .xlsx) perkelti į longrein.team Drive (Sekcija 2)
- [ ] Brand assets (logos, social media) perkelti (Sekcija 3)
- [ ] `.env.local` secrets backup'inti (Sekcija 4)
- [ ] Visi vendor account'ai dokumentuoti (Sekcija 5)
- [ ] Naujas kompiuteris: gali clone'inti repo + dirbti (Sekcija 6)
- [ ] Senas kompiuteris: gali būti išjungtas (Sekcija 7)

---

## Sekcija 1 — GitHub repo (kodas + visi .md docs)

**Kodas saugomas GitHub'e. Naujame kompiuteryje pakanka clone'inti repo, ir visas /APP atsiranda.**

### 1.1 Patikrink, ar viskas push'inta

Terminale paleisk:

```bash
cd ~/Documents/Claude/Projects/APP && git status
```

**Norimas rezultatas:** `nothing to commit, working tree clean`

**Jeigu yra "Untracked files" arba "Changes not staged":** paleisk komandą iš atskiros žinutės žemiau (ji push'ina viską).

### 1.2 Push'ink viską likusį

```bash
cd ~/Documents/Claude/Projects/APP && \
rm -f .git/index.lock .git/HEAD.lock .git/refs/heads/main.lock 2>/dev/null; \
git add -A && \
git commit -m "Pre-migration: push all uncommitted Longrein-Ops + retention playbooks + brand social posts" && \
git push origin main
```

### 1.3 GitHub repo URL (CHECK + DOCUMENT)

- **Repo:** https://github.com/andrejadaranda/stable-manager.git
- **Owner:** andrejadaranda (tavo asmeninis GitHub account'as — ne longrein.team!)
- [ ] **TODO:** Pervadinti repo iš `stable-manager` į `longrein` (GitHub UI → Settings → Repository name → "longrein" → Save). Branduolio darbą daryti vėliau, ne prieš launch'ą.
- [ ] **TODO:** Apsvarstyti repo perkelimą į organization owned by longrein.team (kažkada vėliau, ne dabar).

### 1.4 Naujam kompiuteriui — clone instrukcijos

Naujame Mac'e per Terminal:

```bash
cd ~/Documents
mkdir -p Claude/Projects && cd Claude/Projects
git clone https://github.com/andrejadaranda/stable-manager.git APP
cd APP
npm install
```

Po to dar reikia .env.local atstatyti (žr. Sekcija 4).

---

## Sekcija 2 — Dokumentai į longrein.team Drive

**Reikia rankiniu būdu drag-drop'inti, nes Drive MCP, kurią Claude turi, prijungta prie `trakujojimoklubas@gmail.com` (TJK), ne `longrein.team@gmail.com`.**

### 2.1 Sukurti folder'ių struktūrą longrein.team Drive

Atidaryk `drive.google.com` su `longrein.team@gmail.com`. Sukurk šiuos folder'ius My Drive root'e:

```
Longrein/
├── 00_Code-and-Infra/
│   └── Repository-Link.md  (sukurk Google Doc'ą su GitHub URL + npm install instrukcijomis)
├── 01_Strategic-Docs/      (visi MASTER*, NEXT_STEPS, LAUNCH_PLAN, audit'ai)
├── 02_Playbooks/           (Longrein-* playbooks iš /APP root)
├── 03_Operations/          (Longrein-Ops/ folder'is + 3 .xlsx)
├── 04_Brand/               (brand/logo/, brand/Longrein-Logo-System.html)
├── 05_Social-Content/      (brand/social/posts/, brand/social/longrein-facebook-cover-*)
├── 06_Archive/             (Hoofbeat-*, Stable-OS-Business-Plan.docx)
├── 07_Credentials/         (slaptažodžiai, API keys, vendor accounts)
└── 08_Photos/              (TUŠČIAS dabar; kai bus founder/stable nuotraukos)
```

### 2.2 Drag-drop iš Finder'io

Atidaryk Finder, eik į `~/Documents/Claude/Projects/APP/`. Atidaryk šalia drive.google.com.

**Folder'iai į drag-drop'inti:**

| Iš (lokaliai) | Į (Drive) | Ką tai yra |
|---|---|---|
| `Longrein-Ops/` (visa) | `Longrein/03_Operations/` | 33 ops failai + .xlsx tracker'iai |
| `brand/logo/` (visa) | `Longrein/04_Brand/logo/` | SVG masters + PNG eksportai |
| `brand/social/` (visa) | `Longrein/05_Social-Content/` | Facebook cover + 13 IG post packs + stories |
| `brand/Longrein-Logo-System.html` | `Longrein/04_Brand/` | Brand book HTML |
| `brand/HANDOFF-PROMPT.md` | `Longrein/04_Brand/` | Brand handoff notes |

**Atskiri failai į drag-drop'inti į `Longrein/02_Playbooks/`:**

```
Longrein-Apex-Landing-Deploy.md
Longrein-Brand-Preview.html
Longrein-CalCom-Setup.md
Longrein-Crisis-Comms-Templates.md
Longrein-Customer-Support-FAQ.md
Longrein-Email-Templates.md
Longrein-Final-Smoke-Test.md
Longrein-Founding-Member-Agreement.md
Longrein-Founding-Members-Offer.md
Longrein-Founding-Members-Tracker.md
Longrein-Launch-Day-Runbook.md
Longrein-Onboarding-Zoom-Script.md
Longrein-Outreach-Email-Templates.md
Longrein-Post-Onboarding-Checkins.md
Longrein-Readiness-Audit-2026-05-02.md
Longrein-Referral-Playbook.md
Longrein-W2-Continuation.md
Longrein-Waitlist-Landing.html
Longrein-Weekly-Retention-Review.md
Longrein-MIGRATION-CHECKLIST-2026-05-07.md  (šis failas)
```

**Atskiri failai į `Longrein/01_Strategic-Docs/`:**

```
MASTER.md
MASTER_PLAN.md
LAUNCH_PLAN.md
NEXT_STEPS.md
PRODUCT_BACKLOG.md
PRODUCT_BUILD_PLAN.md
BRAND_NAMES.md
LANDING_COPY.md
INTEGRATION_NOTES.md
HORSE_PROFILE_DESIGN.md
CHAT_PLAN.md
IG_OUTREACH.md
TARGET_LIST_GUIDE.md
RLS_TEST_PLAN.md
target-list-template.csv
```

**Atskiri failai į `Longrein/06_Archive/`:**

```
Stable-OS-Business-Plan.docx
Hoofbeat-Audit-2026-04-30.md
Hoofbeat-Brand-Foundation.docx
Hoofbeat-Brand-Preview.html
Hoofbeat-Launch-Playbook.docx
Hoofbeat-Launch-Playbook-v1.docx
Hoofbeat-Waitlist-Landing.html
```

### 2.3 Verifikuok upload'us

Po visko Drive folder'iuose pažiūrėk failų skaičius. Lūkesčiai:

- `00_Code-and-Infra/`: 1 doc (Repository-Link)
- `01_Strategic-Docs/`: ~15 failų
- `02_Playbooks/`: ~20 failų
- `03_Operations/`: ~33 failai
- `04_Brand/`: logos folder'is + 1-2 brand book failai
- `05_Social-Content/`: facebook cover'iai + posts/ folder'is su ~5 sub-folder'iais
- `06_Archive/`: ~7 failai
- `07_Credentials/`: 3-5 dokumentai (žr. Sekcija 5)

---

## Sekcija 3 — `.env.local` secrets backup

**KRITIŠKAI SVARBU.** `.env.local` yra `.gitignore`'e, taigi NEKADA neatsiranda git'e. Naujame kompiuteryje teks rankiniu būdu atkurti.

### 3.1 Kas yra .env.local

Failas turi 3 eilutes:

```
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

### 3.2 Backup'inimo žingsniai

**Variantas A — Password manager (REKOMENDUOJAMA):**

1. Atidaryk savo password manager'į (1Password / Bitwarden / Apple Passwords)
2. Sukurk naują "Secure Note" pavadinimu **"Longrein .env.local — Production"**
3. Pasted šitaip:

```
# Longrein production env vars
# Source: ~/Documents/Claude/Projects/APP/.env.local
# Last updated: 2026-05-07

NEXT_PUBLIC_SUPABASE_URL=<paste from Terminal: cat ~/Documents/Claude/Projects/APP/.env.local>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<...>
SUPABASE_SERVICE_ROLE_KEY=<...>

# Resend SMTP (already in Supabase Auth → SMTP settings, but back up here too):
RESEND_SMTP_HOST=smtp.resend.com
RESEND_SMTP_PORT=587
RESEND_SMTP_USER=resend
RESEND_SMTP_PASS=<from Resend → API Keys → SMTP password>
```

**Variantas B — Drive Secure Note (jeigu nėra password manager'io):**

1. Drive → `Longrein/07_Credentials/` → New → Google Doc → "ENV-LOCAL-PRODUCTION-SECRETS"
2. Pasted tą patį turinį
3. **SVARBU:** Drive Doc nėra šifruotas — bet kas, turintis prieigą prie longrein.team@gmail, gali skaityti. Tinka tik tada, kai į šitą Gmail account'ą turi prieigą tik tu.
4. Apsaugok longrein.team@gmail.com 2FA + naudok unikalų stiprų slaptažodį.

### 3.3 Naujame kompiuteryje atstatyti

Po `git clone`:

```bash
cd ~/Documents/Claude/Projects/APP
nano .env.local
```

Įklijuok 3 SUPABASE_* eilutes iš password manager'io. Save. Tada:

```bash
npm run dev
```

Jei matai "Internal Server Error" — secret'ai blogi. Pertikrink.

---

## Sekcija 4 — Vendor account'ai (slaptažodžiai)

Jau turi failą `Longrein-Ops/Longrein-Vendor-Accounts-Tracker.xlsx` ir `Longrein-Ops/Longrein-Password-Hygiene-Playbook.md`. **Atidaryk šiandien ir užpildyk visus laukus.** Tai vienintelis šaltinis, kur dokumentuoti, kuris account'as priklauso kuriam emailui ir kuris slaptažodis kur saugomas.

### 4.1 Privalomi vendor'iai (turėtų būti tracker'yje)

Patikrink, kad šie 18+ account'ai pilnai dokumentuoti:

| # | Vendor | Login email | Slaptažodis kur | 2FA įjungta? |
|---|---|---|---|---|
| 1 | Google (longrein.team@gmail.com) | longrein.team@gmail.com | ❓ | ❓ |
| 2 | Google (asmeninis backup — darandaandreja@gmail) | darandaandreja@gmail.com | ❓ | ❓ |
| 3 | Apple ID (recovery — darandaandreja@icloud.com) | darandaandreja@icloud.com | ❓ | ❓ |
| 4 | GitHub (andrejadaranda) | ❓ | ❓ | ❓ |
| 5 | Vercel (web app + landing hosting) | ❓ | ❓ | ❓ |
| 6 | Supabase (database + auth) | ❓ | ❓ | ❓ |
| 7 | Resend (transactional email) | ❓ | ❓ | ❓ |
| 8 | Hostinger (domain registrar — longrein.eu) | ❓ | ❓ | ❓ |
| 9 | Cal.com (demo booking) | ❓ | ❓ | ❓ |
| 10 | Cloudflare (jeigu naudojama) | ❓ | ❓ | ❓ |
| 11 | Stripe (kai įjungsi M9+) | ❓ | ❓ | ❓ |
| 12 | Instagram (@longreinapp) | ❓ | ❓ | ❓ |
| 13 | LinkedIn (Andreja Adaranda asmeninis) | ❓ | ❓ | ❓ |
| 14 | Facebook (page Longrein) | ❓ | ❓ | ❓ |
| 15 | Twitter / X (jei sukurtas) | ❓ | ❓ | ❓ |
| 16 | YouTube (channel Longrein) | ❓ | ❓ | ❓ |
| 17 | TikTok (jei naudojamas) | ❓ | ❓ | ❓ |
| 18 | Notion (jei naudojamas) | ❓ | ❓ | ❓ |
| 19 | Anthropic / Claude.ai | ad@archiprod.eu | ❓ | ❓ |
| 20 | Resend SMTP API key (atskirai nuo Resend account'o) | n/a | ❓ | n/a |

### 4.2 Užpildymo principas

- **Login email** — kuriuo emailu prisijungiama
- **Slaptažodis kur** — `1Password` / `Bitwarden` / `Apple Passwords` / `Drive Secure Note` / `prisimena galvoje (RIZIKA)`
- **2FA** — `taip (TOTP app)` / `taip (SMS — RIZIKA)` / `taip (security key)` / `ne (RIZIKA — taisyk šiandien)`

**RIZIKOS pažymėjimai turi būti adresuoti per artimiausias 7 dienas.**

### 4.3 Trūksta — papildyk dabar

Klausk savęs:
- Ar yra account'ų, kuriuos sukūrei ir užmiršai įrašyti?
- Ar yra senų account'ų po Hoofbeat / Stable OS pavadinimu, kurie reikia migruoti į Longrein?
- Ar yra trial account'ų, kurie po launch'o virsta paid (Cal.com, Stripe)?

---

## Sekcija 5 — Vendor accounts: kuriuos PERKELTI į longrein.team

**Identity hygiene: kai kurie account'ai sukurti su asmeniniais emailais, bet turi būti su `longrein.team@gmail.com`.**

### 5.1 Account'ai, kuriuos REIKIA migruoti į longrein.team email

| Account | Šiuo metu pas | Migruoti į | Kaip migruoti | Skuba |
|---|---|---|---|---|
| Vercel | ❓ asmeninis | longrein.team@gmail.com | Vercel → Settings → Email → Change email; arba sukurk naują team account'ą + transfer projects | 🔴 Prieš launch'ą |
| Supabase | ❓ asmeninis | longrein.team@gmail.com | Supabase → Settings → Team → Invite longrein.team@... → Make owner → leave personal | 🔴 Prieš launch'ą |
| Resend | ❓ asmeninis | longrein.team@gmail.com | Resend → Team → Add member → Make admin → Remove personal | 🔴 Prieš launch'ą |
| Hostinger | ❓ asmeninis | longrein.team@gmail.com | Hostinger → Profile → Change email; reikės verifikacijos | 🟡 Pirmą savaitę |
| GitHub | andrejadaranda | longrein-org (arba palik asmeninį, suteik longrein.team kaip secondary email) | Sukurk GitHub Organization "longrein", transfer repo | 🟢 M3+ |
| Cal.com | ❓ | longrein.team@gmail.com | Settings → Profile → Change email | 🟡 Prieš launch'ą |
| Stripe | ❓ (kai sukursi) | longrein.team@gmail.com | Sukurk iš karto su longrein.team | 🟢 M9 |

### 5.2 Account'ai, kurie LIEKA pas asmeninį emailą

| Account | Pasilieka | Kodėl |
|---|---|---|
| Apple ID (darandaandreja@icloud.com) | Tavo asmeninis | iCloud + iPhone + Apple Pay šeimos asmeniniai dalykai. Naudoja kaip recovery email longrein.team account'ams. |
| LinkedIn (Andreja Adaranda) | Tavo asmeninis | Tu kaip asmuo, ne kompanija. Atskira "Longrein company page" valdoma per tavo profilį. |
| Anthropic / Claude.ai | ad@archiprod.eu (tavo work email) | Tavo personal AI tool license. |

### 5.3 Asmeninių emailų pertvarka

- `darandaandreja@gmail.com` → recovery / sentimental, neimigruoti niekur
- `darandaandreja@icloud.com` → recovery email longrein.team@gmail
- `ad@archiprod.eu` → tavo profesinis email (jei naudoji Claude pro)
- `trakujojimoklubas@gmail.com` → STABLE'ui (TJK), atskira identity, NIEKADA nepainioti su Longrein

---

## Sekcija 6 — Naujas kompiuteris: setup checklist

Kai gauni naują Mac'ą:

### 6.1 First boot (~15 min)

- [ ] Apple ID: `darandaandreja@icloud.com` (recovery + iCloud)
- [ ] iCloud sync: Documents, Desktop, Photos, Keychain, Notes
- [ ] Sign in to Chrome with `longrein.team@gmail.com` (primary work browser)
- [ ] Chrome second profile: `darandaandreja@gmail.com` (asmeninis)

### 6.2 Dev tools (~30 min)

- [ ] Install Homebrew: https://brew.sh
- [ ] `brew install git node nano`
- [ ] Install VS Code (or Cursor / your editor)
- [ ] Install Terminal preferences (if any custom config)
- [ ] `git config --global user.name "Andreja Adaranda"`
- [ ] `git config --global user.email "longrein.team@gmail.com"` (jei nori commit'ų po work email)
- [ ] GitHub CLI: `brew install gh && gh auth login` (browser flow)

### 6.3 Repo + secrets (~10 min)

- [ ] `git clone https://github.com/andrejadaranda/stable-manager.git ~/Documents/Claude/Projects/APP`
- [ ] `cd ~/Documents/Claude/Projects/APP && npm install` (~5 min)
- [ ] Atstatyti `.env.local` iš password manager'io (3 SUPABASE_* eilutės)
- [ ] `npm run dev` → atidaro `localhost:3000`
- [ ] Patikrink, kad localhost'e veikia signup + login

### 6.4 Sanity check (~10 min)

- [ ] Atidaryk Drive: `Longrein/` folder'is rodosi su 8 sub-folder'iais
- [ ] Atidaryk Vendor-Accounts-Tracker.xlsx — visi vendor'iai pilnai užpildyti
- [ ] Prisijungimas prie Vercel veikia
- [ ] Prisijungimas prie Supabase veikia
- [ ] Prisijungimas prie Resend veikia
- [ ] `app.longrein.eu` ir `longrein.eu` atsidaro

### 6.5 Senas kompiuteris

Kai naujas patikrintas:

- [ ] Senas: išvalyk slaptažodžius iš Chrome (Settings → Passwords → Delete all)
- [ ] Senas: išvalyk Keychain (System Settings → Passwords → Delete all)
- [ ] Senas: sign out iš Chrome
- [ ] Senas: sign out iš Apple ID (System Settings → Apple ID → Sign Out)
- [ ] Senas: jei perduodi / parduodi → factory reset (Erase All Content and Settings)
- [ ] Senas: jei pasilieki kaip backup → tiesiog išjunk ir padėk sausoje vietoje

**Niekada neperduok seno kompiuterio be factory reset'o, jei jame buvo Longrein production secrets.**

---

## Sekcija 7 — "Bus surask" nuoroda

Jei naujame kompiuteryje kažko nerandi, tai yra LABIAUSIAI tikėtina lokacija:

| Ko ieškai | Pirmiausia žiūrėk | Antra | Trečia |
|---|---|---|---|
| Longrein kodas | `~/Documents/Claude/Projects/APP/` | `git clone` iš GitHub | n/a |
| Brand assets (logos) | `Longrein/04_Brand/` Drive | `~/Documents/Claude/Projects/APP/brand/logo/` | n/a |
| .md playbook'ai | `Longrein/02_Playbooks/` Drive | `~/Documents/Claude/Projects/APP/Longrein-*.md` | git history |
| Slaptažodžiai | Password manager (1Password) | `Longrein/07_Credentials/` Drive | Email recovery |
| .env.local | Password manager Secure Note | `Longrein/07_Credentials/` Drive | Resend / Supabase dashboard'ai (regeneruoti) |
| Stable plan | `Longrein/01_Strategic-Docs/MASTER.md` | git history | n/a |
| Year1 financial model | `Longrein/03_Operations/Longrein-Year1-Financial-Model.xlsx` | n/a | n/a |
| Vendor account'ai | `Longrein/03_Operations/Longrein-Vendor-Accounts-Tracker.xlsx` | Password manager | Email iš atitinkamo vendor'io |
| Photos / video | `Longrein/08_Photos/` Drive | iPhone | iCloud |

---

## Sekcija 8 — Ko Claude'as nežino ir reikia tavo akių

Šie dalykai gali būti svarbūs migracijai, bet aš (Claude) negaliu jų patvirtinti — turi pati patikrinti:

### 8.1 Galima būti pamiršta

- [ ] **Notion** (jei kažkur pradėjai workspace) — perkelk arba ištrink
- [ ] **Miro / FigJam / whiteboard'ai** — ar yra brainstorm'ų reikalingų pasilikti?
- [ ] **Loom video** — ar yra demo įrašų, kurie turi būti perkelti į Drive?
- [ ] **Email drafts (Gmail)** — ar yra svarbių 10 outreach drafts'ų ne tik šiame dokumente, bet ir Gmail'e?
- [ ] **iMessage / WhatsApp pokalbiai su mentor'iais** — ar yra lessons-learned, kuriuos reikia užfiksuoti į playbook'ą?
- [ ] **Calendar event'ai** — ar Saturday 2026-05-23 09:00 launch alarm jau įdėtas iCal / Google Calendar?
- [ ] **Bank / accounting** — ar verslo banko sąskaita atidaryta? Ar accountant'as turi prieigą prie kažko?
- [ ] **Verslo registracija** — `Longrein-LT-Business-Registration-2026-05-02.md` jau yra Drive'e ar tik lokaliai?

### 8.2 Klausk savęs šiandien

1. Jei mano kompiuteris dabar dingtų į ežerą, kas iš Longrein darbo būtų **negrąžinamai prarasta**?
2. Jei mano longrein.team@gmail account'as būtų užhakintas šiandien, kuriuose vendor'iuose tai nesvarbu, kuriuose esminė bėda?
3. Jei manęs nebūtų 30 dienų (liga), ar yra užrašų, kurie leistų kažkam kitam išleisti Longrein launch'ą Saturday?

Atsakymai į šiuos klausimus pasako, kur dar reikia papildyti šį dokumentą.

---

## Sekcija 9 — Po migracijos verify

Padaryk šituos 3 testus per artimiausias 24h, kad patvirtintum migraciją veikia:

### Test 1 — naujas kompiuteris, fresh clone

- [ ] Naujame Mac'e: clone repo
- [ ] Atstatyk .env.local
- [ ] `npm run dev` → atsidaro `localhost:3000`
- [ ] Atidaryk Calendar puslapį → veikia
- [ ] **Pass:** kodas + secrets persikėlė

### Test 2 — Drive prieiga iš naujo Mac'o

- [ ] Atidaryk Chrome su longrein.team account'u
- [ ] Eik į drive.google.com
- [ ] Atidaryk `Longrein/02_Playbooks/Longrein-Launch-Day-Runbook.md` → atsidaro
- [ ] Atidaryk `Longrein/03_Operations/Longrein-Year1-Financial-Model.xlsx` → atsidaro su duomenimis
- [ ] **Pass:** Drive turtas pasiekiamas

### Test 3 — Vendor login flow

- [ ] Iš naujo Mac'o, naujoje Chrome sesijoje:
  - [ ] Vercel: prisijungti su longrein.team@gmail (jei migravai)
  - [ ] Supabase: prisijungti
  - [ ] Resend: prisijungti
  - [ ] GitHub: prisijungti per gh CLI
- [ ] **Pass:** visi vendor'iai prieinami

**Jei visi 3 testai pereina, migracija baigta. Senas kompiuteris gali būti factory-reset'intas.**

---

## Po šio dokumento

- [ ] Šio failo kopija į Drive `Longrein/02_Playbooks/`
- [ ] Šio failo print'as ant tavo darbo stalo, perbraukti checkbox'us pieštuku
- [ ] Šio failo update'avimas: kai user'is naujame kompiuteryje, įrašyk lentelėje "completed: 2026-05-XX"

---

— migracijos tikslas: 0 prarastų failų, 0 pamesti credential'ų, 0 surprize'ų naujame kompiuteryje. Šis dokumentas padaro tai pasiekiama vienu vakaru.

— Andreja, 2026-05-07
