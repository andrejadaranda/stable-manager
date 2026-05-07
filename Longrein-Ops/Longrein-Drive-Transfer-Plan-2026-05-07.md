# Longrein — New-Computer Transfer Plan
**Sukurta:** 2026-05-07
**Trigger:** Naujas kompiuteris ateina. Viskas turi būti perkelta į longrein.team@ Drive PRIEŠ tai.
**Status quo:** ~3 MB svarbių failų yra TIK lokaliai Mac'e. Drive folderiai sukurti, bet **TUŠTI**.

---

## 🚨 KRITIŠKAS STATUS — ką radau

### ✅ Drive yra tinkamas (longrein.team@ a/c #3 Chrome)
- 8 folderių struktūra **EGZISTUOJA** (00_Brand → 07_Photos)
- Account: `longrein.team@gmail.com`
- 2FA: aktyvuota
- Recovery: `darandaandreja@icloud.com`

### 🔴 BET — Drive yra TUŠTAS
- Total Drive usage: **40 KB iš 15 GB** = praktiškai nulis
- Visos 8 folderiai = "Drop files here" empty state
- Visi 27+ strateginiai dokumentai, brand assets, 40 IG carousel PNGs, 3 Excel modeliai = **TIK lokaliai Mac'e**
- Jei kompiuteris keičiasi DABAR → **viską prarandi**

### 📊 Ką reikia perkelti (~3.1 MB, smulku)

| Šaltinis | Failai | Dydis | Drive paskirtis |
|---|---|---|---|
| `/APP/Longrein-Ops/` (28 MD + 3 XLSX + 1 PNG) | 32 | 612 KB | `06_Ops/` |
| `/APP/brand/` (logo, social, brand book) | 77 | 2.5 MB | `00_Brand/` |
| `/APP/` root (Longrein-* + Hoofbeat legacy) | 41 | ~600 KB | mixed (žr. žemiau) |
| **Total** | **~150 failų** | **~3.7 MB** | — |

### ⛔ NEPERKELIAMA į Drive (→ GitHub vietoj)

| Folderis | Dydis | Kur | Kodėl |
|---|---|---|---|
| `node_modules/` | 1.0 GB | **NIEKUR** | Regeneruojama `npm install` komanda |
| `.next/` | 33 MB | **NIEKUR** | Build artifacts, regeneruojama |
| `.git/` | 7 MB | GitHub | Git istorija, automatiškai per `git push` |
| `app/`, `components/`, `lib/`, `services/`, `database/`, `landing/`, `public/` | ~1.7 MB | GitHub | Tai yra Next.js kodo failai — vietoj Drive eina į GitHub repo |

**Dev chat'as turi GitHub repo'as įkelta.** Patikrink ar jie tai padarė — jei taip, kodas saugu ir naujam kompiuteriui užtenka tik `git clone`.

---

## 🎯 SOLUTION — Google Drive Desktop install (REKOMENDUOJAMA)

Vietoj manualinio drag-drop'o per browser'į (kuris veikia, bet yra one-way), **Google Drive Desktop app** sukuria **persistent dvinarystę** tarp Mac folderio ir longrein.team@ Drive'o. Failai sinchronizuojasi automatiškai. Naujam kompiuteriui — tik install + login = visi failai grįžta.

### Žingsnis 1 — Install (5 min)

1. Atidaryk Safari/Chrome
2. Eik į `https://www.google.com/drive/download/`
3. Click "Download Drive for desktop"
4. Atsisiųsi `GoogleDrive.dmg` (~140 MB)
5. Open .dmg → drag "Google Drive" į Applications
6. Open Applications → Google Drive
7. macOS prašys leidimo Files & Folders access — **Allow**

### Žingsnis 2 — Sign in (2 min)

1. Drive Desktop atveria sign-in puslapį
2. **SVARBU:** sign in su `longrein.team@gmail.com` (NE darandaandreja@gmail.com — tas asmeninis)
3. Jei prašys 2FA → naudok Authenticator app code'ą
4. Patvirtink Drive sync'ą — pasirink **"Stream files"** (tik metadata Mac'e, files atsisiunčiami on-demand) ARBA **"Mirror files"** (kopija lokaliai + Drive — recommended jei vietos yra)
5. Mac'e atsiras nauja vieta: **Finder → Locations → Google Drive → My Drive**

### Žingsnis 3 — Drag-drop iš /APP/ į Drive (15 min)

Atidaryk **du Finder langus** šalia vienas kito:
- **Window 1:** `/Users/andrejadaranda/Documents/Claude/Projects/APP/`
- **Window 2:** `Google Drive → My Drive`

**Drag/copy operacijos** (po vieną folderį, nesukukpos copies):

| Iš (lokalus) | Į (Drive) | Failų skaičius |
|---|---|---|
| `APP/Longrein-Ops/` (visa folderis) | `My Drive/06_Ops/` | 32 |
| `APP/brand/` (visa folderis) | `My Drive/00_Brand/` | 77 |
| `APP/Longrein-Ops/Longrein-Year1-Financial-Model.xlsx` | `My Drive/05_Finance/` | 1 (move/copy) |
| `APP/Longrein-Ops/Longrein-Weekly-Dashboard-Year1.xlsx` | `My Drive/05_Finance/` | 1 (move/copy) |
| `APP/Longrein-Ops/Longrein-LT-Business-Registration-2026-05-02.md` | `My Drive/01_Legal/` | 1 (copy) |
| `APP/Longrein-Ops/Longrein-Founding-Members-Pack-2026-05-02.md` | `My Drive/03_Customers/` | 1 (copy) |
| `APP/Longrein-Ops/Longrein-Customer-Onboarding-SOP-2026-05-02.md` | `My Drive/03_Customers/` | 1 (copy) |
| `APP/Longrein-Ops/Longrein-Customer-Support-KB-2026-05-05.md` | `My Drive/03_Customers/` | 1 (copy) |
| `APP/Longrein-Ops/Longrein-FM-Customer-Success-Playbook-2026-05-02.md` | `My Drive/03_Customers/` | 1 (copy) |
| `APP/Longrein-Ops/Longrein-IG-First-30-Days-2026-05-02.md` | `My Drive/04_Marketing/` | 1 (copy) |
| `APP/Longrein-Ops/Longrein-LinkedIn-First-30-Days-2026-05-02.md` | `My Drive/04_Marketing/` | 1 (copy) |
| `APP/Longrein-Ops/Longrein-Public-Launch-Press-Kit-2026-05-02.md` | `My Drive/04_Marketing/` | 1 (copy) |
| `APP/Longrein-Ops/Longrein-Channel-Partnership-Playbook-2026-05-02.md` | `My Drive/04_Marketing/` | 1 (copy) |
| `APP/Longrein-Ops/Longrein-Trakai-Case-Study-Draft-2026-05-02.md` | `My Drive/04_Marketing/` | 1 (copy) |
| `APP/Longrein-Ops/Longrein-DACH-Expansion-Playbook-2026-05-02.md` | `My Drive/04_Marketing/` | 1 (copy) |

**Patarimas:** vietoj per-failo distribute'inimo, **iš pradžių sumesk visus į 06_Ops** (greitai, 1 drag), tada per Drive web move'ink po keletą į kitas folderius. Sutaupo 80% laiko.

### Žingsnis 4 — APP root failai (5 min)

Tie 41 root failai (Longrein-*, Hoofbeat-*, MASTER, LANDING, etc.) — **pasirinkimas:**

**Variantas A (rekomenduojamas):** Sukurk subfolder'į `06_Ops/_archive_root/` ir sumesk visus 41 failus ten. Vėliau švarinsies, jei reikės.

**Variantas B:** Distribute'ink:
- `Hoofbeat-*` → `06_Ops/_archive_legacy/` (legacy, naudosi tik referencei)
- `Longrein-Brand-Preview.html`, `Longrein-Waitlist-Landing.html` → `00_Brand/`
- `Longrein-Final-Smoke-Test.md`, `Longrein-Apex-Landing-Deploy.md` → `06_Ops/_dev_handoff/`
- Visa kita (`MASTER.md`, `MASTER_PLAN.md`, `LAUNCH_PLAN.md`, etc.) → `06_Ops/`

### Žingsnis 5 — Verify sync (5 min)

1. Atidaryk `https://drive.google.com/drive/u/3/my-drive`
2. Patikrink **kiekvieną** folderį:
   - 00_Brand: turi būti subfolder'iai `logo/`, `social/`, plus HTML brand book + 2 PNG'ai
   - 01_Legal: 1 file
   - 02_Product: (kol kas tuščia — galimas paskirtis app spec'ams ateityje)
   - 03_Customers: 4 files
   - 04_Marketing: 7 files
   - 05_Finance: 2 xlsx
   - 06_Ops: ~20 files + _archive subfolder
   - 07_Photos: (kol kas tuščia — naudojama landing page'oms TJK foto)
3. Drive storage indikatorius **NEBETURI rodyti 40 KB** — turėtų būti ~5-10 MB

---

## 📋 ALTERNATYVA — Browser drag-drop (jei nenori install'inti Drive Desktop)

Jei Drive Desktop atrodo per kompleksiškas — galima per browser'į. **BET:** vienkartinis veiksmas, ne sync'as. Naujas kompiuteris turės pakartoti.

1. Atidaryk Drive web: `https://drive.google.com/drive/u/3/my-drive`
2. Atidaryk Finder folderį `/Users/andrejadaranda/Documents/Claude/Projects/APP/`
3. Click į `06_Ops` Drive'e (atveri folder'į)
4. **Drag visus 32 failus iš `Longrein-Ops/` į browser'į** — Drive auto-uploads
5. Pakartoti su kitomis folderiais

**Trūkumai:**
- Reikia kartoti naujam kompiuteriui (jei ten nori failus turėti lokaliai)
- Be sync'o — jei keisi failą Mac'e, Drive nepasitupdate'ina automatiškai

**Jei nori paprasto upload + niekada negalvoti** → Drive Desktop. Jei nori "vienąkart paskelbti viską ir pamiršti" → browser drag-drop.

---

## 🔐 BITWARDEN — patikrink slaptažodžius

Atidaryk Bitwarden (`https://vault.bitwarden.eu`) ir patvirtink, kad **kiekvienas šitas account turi įrašą**:

### Privalomi (be šitų — kompiuterio keitimo metu pasiklysi):

| Vendor | Account email | Login URL | Slaptažodis Bitwarden? |
|---|---|---|---|
| Hostinger | longrein.team@ | hpanel.hostinger.com | ☐ |
| Cloudflare | darandaandreja@icloud.com | dash.cloudflare.com | ☐ |
| Vercel | longrein.team@ | vercel.com | ☐ |
| Supabase | **TBD** ⚠️ | app.supabase.com | ☐ ❓ |
| Resend | longrein.team@ | resend.com | ☐ |
| Stripe | longrein.team@ | dashboard.stripe.com | ☐ |
| Bitwarden master | darandaandreja@icloud.com | vault.bitwarden.eu | (recover via email) |
| Gmail (longrein.team) | longrein.team@ | accounts.google.com | ☐ |
| Gmail (darandaandreja personal) | darandaandreja@gmail.com | accounts.google.com | ☐ |
| iCloud (recovery email) | darandaandreja@icloud.com | appleid.apple.com | ☐ |

### Social media (svarbūs, bet recovery'is per email pasiekiamas):

| Platform | Slaptažodis Bitwarden? |
|---|---|
| Instagram (@longreinapp) | ☐ |
| LinkedIn (Andreja personal + Company Page) | ☐ |
| YouTube/Google Brand Account | ☐ |
| Facebook (Page + personal) | ☐ |
| TikTok (reserved) | ☐ |
| X / Twitter (reserved) | ☐ |
| Trakų Jojimo Klubas IG | ☐ |

### Tools — vidutinis prioritetas:

| Vendor | Slaptažodis Bitwarden? |
|---|---|
| Notion (longrein.team@) | ☐ |
| Cal.com | ☐ |
| Termly | ☐ |
| Loops.so | ☐ |
| Plausible | ☐ |
| Buffer (jei jau setup'inta) | ☐ |
| Canva | ☐ |
| Adobe Creative Cloud (jei naudoji) | ☐ |

### KRITINIAI 2FA backup codes (Bitwarden Secure Notes):

Šitie YRA NE slaptažodžiai, bet 8-10 vienkartinių kodų — be jų gali užsirakinti out:

| 2FA service | Backup codes saved? |
|---|---|
| Gmail (longrein.team) — 8 codes | ☐ |
| Bitwarden master account 2FA | ☐ |
| Vercel 2FA | ☐ |
| Stripe 2FA | ☐ |
| Hostinger 2FA | ☐ |
| Supabase 2FA | ☐ |

**Kur saugoti:** Bitwarden → New → **Secure Note** → title "Gmail longrein.team backup codes" → paste 8 codes → save. Pakartoti per kiekvieną service'ą.

### 🔴 .env.local secrets — KRITIŠKAI svarbu

`/APP/.env.local` faile yra **production credentials** (DB URL, API keys). NIEKAD nedalink, NIEKAD nekelt į Drive arba Git.

**Action:**
1. Atidaryk `/APP/.env.local` Mac'e
2. Bitwarden → New → Secure Note → title "Longrein .env.local production"
3. **Copy-paste visą file content'ą** į Notes lauką
4. Save

Naujam kompiuteriui — atidarysi šitą Secure Note, copy-paste atgal į naujo kompiuterio `.env.local`. Be šito naujas kompiuteris **negalės paleist app'o lokaliai**.

---

## 🧱 KAS DAR REIKIA — gap'ai aptarti

### 1. Supabase ownership ⚠️
Vendor Tracker rodo Supabase email = "TBD." App jau egzistuoja — todėl Supabase project'as kažkokiam email priklauso. **Patikrink:**
- Atidaryk `https://app.supabase.com`
- Login su tikru email (greičiausiai `darandaandreja@gmail.com`?)
- **Jei Supabase yra ant darandaandreja@ (asmeninio):** reikia transferinti į longrein.team@ ARBA invite longrein.team@ kaip admin'ą
- Jei dev chat'as setup'ina Supabase production'e, paklausk jo

### 2. Vercel ownership
Tas pats — Vercel'is greičiausiai ant `longrein.team@`, bet jei dev chat'as deploy'ina iš asmeninio account'o, reikia patvirtinti.

### 3. GitHub repo
**Kur Longrein code'as?**
- Ar yra GitHub repo `github.com/longrein-team/longrein` ar pan.?
- Account email = longrein.team@? Andreja personal?
- Repo private? (turi būti private — tai privatus IP)
- Dev chat turi accesso?

Naujam kompiuteriui:
- Install Git
- `git clone <repo-url>`
- Sign in su saugiu account'u
- Skip Drive — kodas yra GitHub'e

### 4. LT business banking + accountant (still TBD)
Vendor Tracker'yje tie du yra "TBD" — tai pelnyta, bus paskirta verslą registruojant pagal `Longrein-LT-Business-Registration` doc'ą.

### 5. SSH keys (jei naudojami)
Jei tau yra SSH key'ai (Git, server'iai) — `~/.ssh/` folderis svarbus:
- iCloud Keychain'as juos atsimena (ar tu naudoji Apple Keychain'ą?)
- Bitwarden Secure Notes'e galima saugot SSH private key'ą jei nori cross-device

### 6. Bookmark folderiai Chrome
Jei nori, kad bookmark'ai sekė tave — Chrome'e turi būti įjungtas sync su `longrein.team@`. Patikrink: Chrome → Settings → You and Google → Sync.

---

## 📦 NAUJO KOMPIUTERIO SETUP — kas turi vykti

Po visko aukščiau (Drive Desktop install + Bitwarden full + GitHub repo verified), naujas kompiuteris bus paruoštas per:

1. **macOS install + Apple ID** (10 min)
2. **Chrome install + sign-in su 4 account'ais** — ad@archiprod.eu (Cowork), darandaandreja@gmail.com (asmeninis), longrein.team@gmail.com (verslas), trakujojimoklubas@gmail.com (klubas) (5 min)
3. **Bitwarden install + master password** (5 min)
4. **Google Drive Desktop install + sign in longrein.team@** (5 min) — auto-sync visi failai per ~10 min
5. **Git install + clone Longrein repo + paste .env.local iš Bitwarden** (10 min)
6. **`npm install` /APP'e** (~5 min)
7. **`npm run dev` — patvirtinti app paleidžia** (1 min)

**Total naujam kompiuteriui:** ~40 min iki full operating capacity.

---

## ❓ KLAUSIMAI MAN — atsakyk kai galėsi

**Drive transfer:**
1. Pasirinki Drive Desktop install (rekomenduojama) ar browser drag-drop?
2. APP root folderio 41 failai — variantas A (visi į 06_Ops/_archive_root/) ar variantas B (distribute'inti)?

**Patikrini ir atsakyk:**
3. Bitwarden — kuriai iš ~22 vendor accounts JAU turi slaptažodį Bitwarden? (lentelė viršuj — pažymėk ☐ → ✅)
4. Supabase production project ant kurio email account'o yra? (`darandaandreja@gmail.com` ar `longrein.team@gmail.com`?)
5. GitHub repo yra? Jei taip — URL kokias? (kad galėčiau patikrinti)
6. `.env.local` jau Bitwarden'e išsaugojai? (kritiškai svarbu)
7. Naujas kompiuteris ateina kada — savaitės bėgyje, mėnesio bėgyje, kelių dienų?

**Veiksmų prioritetas (mano patarimas):**
1. **DABAR (10 min):** Open .env.local → copy-paste į Bitwarden Secure Note. Tai yra 1 daiktas, kuris jeigu pasimes, dev chat'as negalės paleist new computer'į.
2. **ŠIANDIEN (1h):** Drive Desktop install + drag /APP/Longrein-Ops/ ir /APP/brand/ → Drive folderiai
3. **RYTOJ (30 min):** Bitwarden audit pagal lentelę aukščiau — užbaigti slaptažodžius
4. **KAI ATEINA naujas kompiuteris:** seki Naujo kompiuterio setup checklist'ą (40 min total)

---

**Owner:** Andreja
**Status:** AUDIT COMPLETED — visas nesinchronizuotas content lokaliai (3.7 MB) identifikuotas
**Next:** Action plan'as įvykdyti — Drive Desktop install + drag iki naujo kompiuterio dienos
**Drive URL:** https://drive.google.com/drive/u/3/my-drive (longrein.team@ account #3)
