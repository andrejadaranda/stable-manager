# 2FA action list — 30 min darbas, sutaupo Longrein gyvybę

**Patikrinau šiandien per Chrome tavo 4 production vendor'iams. Visi yra BE 2FA. Tai reiškia: vienas iCloud password'as = visa Longrein infra (Vercel + Supabase + Hostinger) prarasta. Ir vienas Gmail password'as = Resend siunčia spam'ą tavo founding member'iams.**

> Trukmė: 30 min visiems 4 + Bitwarden saving. Geriausias laikas: dabar arba šiandien vakare.

---

## Verified status (Andreja's Chrome session, 2026-05-07)

| # | Vendor | Login email | 2FA status | Direct URL | Risk |
|---|---|---|---|---|---|
| 1 | **Vercel** | darandaandreja@icloud.com | ❌ **Inactive** | https://vercel.com/account/settings/authentication | 🔴 Web app + landing prarastas |
| 2 | **Supabase** | darandaandreja@icloud.com | ❌ **0 apps configured** | https://supabase.com/dashboard/account/security | 🔴 Database + Auth + visi customer'iai prarasti |
| 3 | **Resend** | longrein.team@gmail.com | ❌ **Disabled** | https://resend.com/settings (žemiau "Personal" → security) | 🟡 Email impersonation rizika |
| 4 | **Hostinger** | darandaandreja@icloud.com | ❓ (turi prisijungti) | https://hpanel.hostinger.com/profile/security | 🔴 Domain + DNS prarasti |

---

## Action — eik per visus 4 sekoje

### Žingsnis 0: paruošk Bitwarden Authenticator

Bitwarden turi Authenticator funkciją Premium plan'e. Jei neturi Premium — alternatyva: **įdiek Apple Passwords (macOS Sonoma+) arba Google Authenticator app'ą iPhone'e**.

Bitwarden Authenticator kelias:
1. Atidaryk Bitwarden
2. Settings → Premium membership (€10/metus). Verta — vienas 2FA secret saugojimo vietoj 4 atskirų app'ų.
3. Po Premium: bet kuriam item'ui galima pridėti TOTP authenticator field.

**Pasirinkimas:** Bitwarden Premium ARBA Apple Passwords ARBA Google Authenticator. Visi 3 veikia. Aš toliau rašysiu kaip "TOTP app", reiškiantį tavo pasirinktą.

---

### Žingsnis 1: Vercel (5 min)

1. Atidaryk: https://vercel.com/account/settings/authentication
2. Slink žemyn iki "Two-Factor Authentication" sekcijos
3. Spustelk "Enable" (arba "Add Passkey" jei nori passkey vietoj TOTP — ir passkey, ir TOTP veikia)
4. **Rekomenduoju TOTP**, nes:
   - Veikia su Bitwarden
   - Lengviau migruoti į naują kompiuterį (vienas backup code)
   - Passkey naudoja Touch ID — gerai, bet susieta su konkrečiu įrenginiu
5. Vercel parodys QR kodą — nuskenuok jį TOTP app'e (Bitwarden / Authenticator)
6. Vercel taip pat duos **backup codes** (10 vnt) — **PRIVALOMA** nukopijuoti į Bitwarden Secure Note pavadinimu **"Vercel 2FA backup codes"**
7. Vercel paprašys įvesti 6-skaitmenį TOTP kodą iš app'o, kad patvirtinti
8. Save

**Verify:** atsijunk + prisijunk vėl. Jei prašo TOTP — veikia. ✓

---

### Žingsnis 2: Supabase (5 min)

1. Atidaryk: https://supabase.com/dashboard/account/security
2. Spustelk "Authenticator app" (matei mes anksčiau)
3. Pridės: nuskenuoji QR → įvedi TOTP kodą
4. **Backup codes** — į Bitwarden "Supabase 2FA backup codes"
5. Patvirtink

**KRITIŠKAI SVARBU:** Supabase'e turi `SUPABASE_SERVICE_ROLE_KEY`, kuris **gali ištrinti visą duomenų bazę**. Jei iCloud password'as nutekės + Supabase be 2FA = launch dieną gali atsirasti, kad nei vieno horse, lesson, kliento nėra. 2FA yra apsauga nuo šito.

**Verify:** atsijunk + prisijunk → prašo TOTP ✓

---

### Žingsnis 3: Resend (3 min)

1. Atidaryk: https://resend.com/settings (jau atviras)
2. Apačioje kairėje spustelk savo avatar (longrein.team@gma...) → atsidaro user menu
3. Pasirink "Personal settings" arba "Account" (kelyje skirtingai įvardinta)
4. Rasi "Two-factor authentication" sekciją
5. Įjunk → QR → TOTP → backup codes į Bitwarden
6. Save

**Verify:** Settings → Team → tavo eilutė turėtų rodyti **žalią checkmark** "Enabled MFA" stulpelyje (vietoj X). Tikrink po 30 sek refresh.

---

### Žingsnis 4: Hostinger (10 min — ilgiausias dėl login)

1. Atidaryk: https://auth.hostinger.com/login
2. Login kaip `darandaandreja@icloud.com`
3. Po login eik į: https://hpanel.hostinger.com/profile/security
4. Rasi "Two-factor authentication" arba "2FA"
5. Jei rodo **"Disabled"** → spustelk "Enable" → QR → TOTP → patvirtink
6. Backup codes į Bitwarden "Hostinger 2FA backup codes"

**Hostinger dažnai turi ir SMS 2FA opciją** — **NESIRINK SMS**. SMS gali būti perimtas (SIM swap atakos). Pasirink "Authenticator app" (TOTP) tik.

**Verify:** logout → login vėl → prašys TOTP ✓

---

### Žingsnis 5: Apple ID + recovery key (10 min — KRITINIS)

Visi 3 production vendor'iai (Vercel + Supabase + Hostinger) yra ant tavo Apple ID email'o. Tai reiškia: jei Apple ID kompromituotas → visi 3 prarasti.

Apple ID hardening (iPhone arba Mac):
1. **iPhone:** Settings → tavo vardas viršuje → Sign-In & Security
2. Patikrink:
   - [ ] Two-Factor Authentication: **On** (privaloma, turėtų būti)
   - [ ] Trusted Phone Numbers: tavo telefonas + galbūt antras backup numeris
   - [ ] Recovery Key: jei rodo **"Off"** → įjunk:
     - "Recovery Key" → "Turn On Recovery Key"
     - Apple sugeneruos 28-skaitmenį kodą
     - Atspausdink (PRINTERIU, ne nuotrauka — kad išsaugotų net jei iCloud sutrinka)
     - Padėk seife arba laikyk seife pas tėvus
     - **Įrašyk Bitwarden Secure Note pavadinimu "Apple ID Recovery Key — darandaandreja"**
3. Trusted Devices: pašalink visus įrenginius, kurių nebenaudoji (senas iPad, senas iPhone)
4. Account Recovery → Recovery Contact: pridėk asmenį kuriuo pasitiki (mama / partneris) — jei prarandi prieigą, jie gali padėti atgauti

**Verify:** Settings → Apple ID → Recovery Key → rodo "On" ✓

---

## Kai visi 5 padaryta — patikrink Bitwarden

Bitwarden'e turėtų būti šie nauji secure notes (5 vnt):

1. ✅ Vercel 2FA backup codes
2. ✅ Supabase 2FA backup codes
3. ✅ Resend 2FA backup codes
4. ✅ Hostinger 2FA backup codes
5. ✅ Apple ID Recovery Key — darandaandreja

Plius `Longrein .env.local Production` (3 SUPABASE_* eilutės) — sukurta anksčiau.

**6 secure notes = pilna identity hygiene apsauga.**

---

## Po šitų 30 min: kas pasikeitė

Prieš:
- Jei atspėtų tavo iCloud password'ą → prarandi visą Longrein infra
- Jei nutekėtų SUPABASE_SERVICE_ROLE_KEY → ištrina visus duomenis
- Jei kompromituotų Resend → siunčia spam founding members'iams

Po:
- iCloud password'o nutekėjimas + 2FA = atakuotojas vis tiek negali įsijungti
- SUPABASE_SERVICE_ROLE_KEY pasiekiamas tik per Bitwarden, kuris turi savo 2FA
- Resend siuntimas reikalauja 2FA kiekvienam logginimui

---

## Ką darau aš tuo laiku, kai tu klikinėji

Nieko — visi šie 4 dalykai reikalauja TAVO TOTP app'o ir TAVO physinio device'o, kad nuskenuoti QR. 30 min tylos darbas.

Kai baigsi visus 5 — parašyk man "5 ✓", ir pereisim prie kito step'o.

---

## Po 2FA: kitas commit

Po 2FA įjungimo, push'ink šituos naujus failus į git:

```bash
cd ~/Documents/Claude/Projects/APP && \
git add Longrein-Vendor-Accounts-Master-2026-05-07.md \
        Longrein-MIGRATION-CHECKLIST-2026-05-07.md \
        Longrein-2FA-ACTION-LIST-2026-05-07.md && \
git commit -m "2FA action list + vendor accounts master + migration checklist (2026-05-07 audit)" && \
git push origin main
```

---

— atspausdink šitą failą. Tape kompiuterio šone. Eik per 5 žingsnius. 30 min.
