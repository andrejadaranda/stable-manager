# Longrein — Password Hygiene Playbook

**Šis dokumentas yra TAVO biznio saugumo pagrindas.** Vienas pažeistas slaptažodis = visa įmonė offline. Šios taisyklės kainuoja 30 min disciplinos per mėn., bet apsaugo nuo katastrofos. Skaityk vieną kartą, įsidėk į galvą, naudok visam gyvenimui.

---

## 1. Identity architektūra — keturi sluoksniai

Kiekvienas sluoksnis turi vieną aiškią funkciją. NIEKADA nemaišyk lygmenų.

### Lygmuo 1 — ROOT identity (pati svarbiausia)
**Bitwarden master password.** Tavo galvoje + viename fiziniame backup'e.
- 20+ simbolių, niekur nerašytas digitally
- Niekada neįvedi į kitą svetainę išskyrus vault.bitwarden.com
- Jei prarasi — VISKAS prarasta. Bitwarden tau nepadės. Net Anthropic tau nepadės. Toks slaptažodis turi būti taip ilgai pažįstamas, kad atsimentum jį po 5 metų be naudojimo.
- Backup: parašyk fiziškai vieną kartą ant popieriaus, įdėk į voką, dėk į seifą arba banko safe deposit box. Jokio nuotraukų. Jokio Notion. Jokio rankraščio nuotraukos asmeniniame email'e.

### Lygmuo 2 — COMPANY CORE identity
**longrein.team@gmail.com** + jo slaptažodis.
- Slaptažodis SAUGOMAS TIK Bitwarden'e
- Recovery email: darandaandreja@icloud.com
- Recovery telefonas: tavo asmeninis numeris
- 2FA: Google Authenticator app (NE SMS — SIM swap'ai realūs)
- Backup codes: 8 print'inti, fiziškai laikomi (sąsiuvinis seife arba kontraktų aplankas)

### Lygmuo 3 — VENDOR identities
**Visi vendor'ių account'ai (Hostinger, Vercel, Resend, Stripe, Cal.com, Notion ir t.t.).**
- Account email: VISADA longrein.team@gmail.com (jei vendor'is leidžia)
- Slaptažodis: VISADA generuotas Bitwarden'e (16+ simbolių, random)
- Slaptažodis SAUGOMAS TIK Bitwarden'e
- 2FA: VISUR įjungta per Authenticator app, NE SMS
- Recovery: visada per longrein.team@gmail.com (kai vendor'is leidžia)

### Lygmuo 4 — DERIVED credentials (techniniai raktai)
**API keys, Stripe webhook secrets, Supabase service role keys, DKIM private keys ir t.t.**
- Saugomi tik .env failuose ant tavo serverio (Vercel environment variables)
- Backup'as Bitwarden'e secure note formatu
- Niekada neįvesi į GitHub, niekada nesidalink chat'e, niekada nematysi screenshot'e
- Rotinkk kas 6 mėn. (Stripe, Supabase) arba kai kažkas pastebimai netikėto įvyksta

---

## 2. Ką NIEKADA neperžengti

| Niekada nedaryk | Kodėl |
|---|---|
| Naudok longrein.team slaptažodį kitur | Vienas nutekėjimas = visa įmonė |
| Įvesk slaptažodžių chat'e (čia ar bet kur) | Chat history persistsi, ekrano nuotraukos persiunčiamos |
| Siųsk slaptažodžių email'u | Email nėra encrypt'as |
| Saugok Bitwarden master password Notion'e ar Drive | Defeats the purpose |
| Įjunk SMS 2FA bet kuriam svarbiam account'ui | SIM swap = visiškai automatinė ataka |
| Kurk vendor account su personal email | Negalėsi perduoti, jei team augs |
| Naudoju „Login with Google" anonimines svetaines | Tavo longrein.team @gmail tampa autorize'imo source — sukuria invisible attack surface |
| Įjunk biometric 2FA tik | Telefonas pamestas = lock out. Visada turi backup codes |
| Saugok backup codes telefone (foto, notes) | Telefonas yra tas pats device, kurio backup tu kuri |
| Patikėk vendor'iui, kad „mes nustatysim 2FA vėliau" | „Vėliau" niekada neateina, ir tu būsi pažeidžiamas iki to |

---

## 3. Slaptažodžių rotacijos grafikas

| Slaptažodis | Rotinkk kas | Kada papildomai |
|---|---|---|
| Bitwarden master password | 12 mėn. | Jei kažkas matė tave įvedžiantį, jei prarasta įrenginį |
| longrein.team@gmail.com | 6 mėn. | Jei matai non-recognized device prisijungimą |
| Vendor accounts (Stripe, Hostinger, Vercel, Supabase) | 12 mėn. | Po data breach pranešimo iš to vendor'iaus |
| API keys (Stripe, Supabase, Resend) | 6 mėn. | Po deploy'o iš naujo dev environment'o, po team žmogaus išvažiavimo |
| Recovery codes (visiems) | Kai sunaudoji nors vieną | Generuok naujus, sunaikink senus |

**Bitwarden tau primins automatiškai per password health alerts.**

---

## 4. Lost device recovery — žingsnis po žingsnio

**Scenarijus:** Pamesti / pavogtas tavo telefonas (kuriame Authenticator + Bitwarden mobile).

### Step 1 — pirmos 30 min
1. Iš kito įrenginio (Mac) login'kis į Bitwarden vault.bitwarden.com (master password tu žinai)
2. Iš Bitwarden — atrakink longrein.team@gmail.com slaptažodį
3. Login'is į Gmail per browser'į — Google paklaus 2FA
4. Naudok **vieną backup code** iš fizinio voko (turi 8 — likai 7)
5. Po prisijungimo — eik į My Account → Security → 2-Step Verification
6. Sumažink old device'ą: „Manage trusted devices" → revoke'k pavogtą telefoną
7. Sukurk naują Authenticator setup'ą naujam telefonui (kai gausi)

### Step 2 — sekančios 24 val
1. Iš Bitwarden vault'o — patikrink visus aktyvius vendor account'us
2. Kiekvienam svarbiam (Hostinger, Vercel, Stripe, Supabase) — login + check active sessions + sign out from all devices
3. Pakartok 2FA setup kiekvienam svarbiam vendor'iui ant naujo įrenginio

### Step 3 — telefono atstatymas (kai turi naują)
1. Įdiek Google Authenticator
2. Pakartok 2FA setup procesą KIEKVIENAM account'ui (Gmail, Bitwarden, Hostinger, Vercel ir t.t.)
3. **Negeneruok naujų backup codes, kol visus 7 likusius nesunaudosi** — Google leis per kelis prisijungimus

### Step 4 — atnaujink šį dokumentą
1. Pažymėk „Naudoti backup codes: 1 (lieka 7)"
2. Jei sunaudoji 4+ codes, generuok naujus 8 ir sunaikink senus

---

## 5. Compromised account incident response

**Signalai, kad account'as pažeistas:**
- Login pranešimas iš nepažįstamos vietos
- Slaptažodis nustojo veikti
- Vendor sąskaitybos charge'ai, kurių nedavei
- Email'ai, siųsti tavo vardu, kurių nesiuntei
- Posty social media, kurių nepostinai

**Atsakas — pirmos 60 min:**
1. **Jei galima prisijungti** — pakeisk slaptažodį DABAR
2. **Visi 2FA backup codes — invalidate'k ir generuok naujus**
3. **Sign out from all devices** (Google: My Account → Security → Your devices → Sign out)
4. **Patikrink connected apps** (Google: Security → Third-party apps with account access) — pašalink viską, ko neatpažįsti
5. **Patikrink email forwarding rules** (Gmail: Settings → Filters and Blocked Addresses) — atakuotojai dažnai pridėjo invisible forward, kad gautų visus tavo email'us be prisijungimo
6. **Patikrink recovery email + telefoną** — atakuotojas galėjo pakeisti, kad blokuotų recovery
7. **Jei pažeistas Gmail core account (longrein.team) — KIEKVIENAS vendor'iaus accountas pažeidžiamas.** Eik per visus Bitwarden vault'o įrašus ir keisk slaptažodžius eilėje.

**Kontaktai pagalbai:**
- Google: https://accounts.google.com/AccountChooser → Help → Account recovery
- Bitwarden: support@bitwarden.com (atsako per 24-48 val)
- Lietuvos CERT (jei piniginių paskyrų pažeidimas): cert.lt

---

## 6. Backup codes — fizinis valdymas

**Kiekvienas account'as su 2FA leidžia generuoti 8-10 backup codes. Šie kodai yra single-use.**

### Saugojimo taisyklės

1. **Print iškart po 2FA setup'o** (NE save kaip PDF)
2. **Įdėk į patvarą voką** (NE plastikinį maišelį, NE post-it)
3. **Pažymėk voką:** „Longrein Team Gmail backup codes — sukurta 2026-05-02"
4. **Vieta:** seifas, banko safe deposit box, sutarties popierių aplankas (NE kuprinė, NE namų stalo stalčius)
5. **Antras backup voko egzempliorius:** kitoje fizinėje vietoje (jei pirma vieta sudegs — turi backup'ą backup'ui)

### Naudojimas

- Naudok TIK kai prarasti telefoną
- Po panaudojimo užbrauk kodą tame pačiame voko popieriuje
- Kai liko 2 nesunaudoti — generuok naujus 8 ir sunaikink senus (su shred'eriu, NE į šiukšliadėžę)

### Inventarizacija

| Account'as | Date generated | Backup codes left | Vault location |
|---|---|---|---|
| longrein.team@gmail.com | TBD (after 2FA setup) | 8 / 8 | TBD |
| Bitwarden master vault | TBD | 8 / 8 | TBD |
| (Vendor accounts kaip pridėsi) | | | |

**Šitą lentelę atnaujink kiekvieną kartą, kai sunaudoji code arba generuoji naujus.**

---

## 7. Kai turėsi team — access sharing rules

Solo founder dabar — bet planuok šiandien, kad rytoj nebūtų chaoso.

### Niekada nesidalink slaptažodžiu

Net su pasitikėjimu žmogumi. Jei reikia, kad jis prieitų prie kažko:
- Bitwarden organization plan (€3/user/mo) — share slaptažodžiu per Bitwarden, ne per chat
- Vendor'iaus „team member" feature — pridedama TIK kaip atskira identity (jo email, jo slaptažodis, jo 2FA)
- Niekada „čia mano slaptažodis, login'isi" — tai pažeidžia audit trail ir 2FA logiką

### Kai pridedami team narį

1. Sukurk jiems atskirą email'ą @longrein.eu (per Workspace, kai turėsi)
2. Pridėk jį prie kiekvieno reikalingo vendor'iaus per „Invite team member"
3. Jis kuria SAVO slaptažodį, SAVO 2FA
4. Jam suteik MINIMAL permissions (read-only kur galima)
5. Užregistruok šitą access'ą šiame dokumente (kas ką gali daryti)

### Kai team narys palieka

1. PIRMA — revoke'k jo prieigą per kiekvieną vendor'ių (per „Remove team member")
2. ANTRA — keisk visus shared slaptažodžius (jei jis matė per Bitwarden organization)
3. TREČIA — sign out his sessions everywhere (per Google Workspace admin → User → Sign out)
4. KETVIRTA — peržiūrėk audit log'us ar nepadarė kažko nestandartinio

---

## 8. Mėnesinė saugumo rutina (15 min)

Kiekvieno mėnesio pirmą pirmadienį:

- [ ] Bitwarden → Reports → Password Health → Pataisyk reused/weak/exposed passwords
- [ ] Google → My Account → Security → Recent Activity → Patikrink ar nieko nepažįstamo
- [ ] Vercel / Stripe / Supabase → Audit log → Bet kokie netikėti API calls?
- [ ] Patikrink Backup codes inventarizacijos lentelę §6 — reikia ar negeneruoti naujų?
- [ ] Login'isi į kiekvieną svarbų vendor'ių, patvirtink, kad slaptažodis vis dar veikia (kartais per server-side migracijas slaptažodžiai pasiklydusiai įvyksta)

15 min. Vienas pirmadienis per mėnesį. Tai disciplina, kuri skiria „lengva atsigauti" nuo „prarasti įmonę".

---

## 9. Greitas kontrolinis sąrašas (kai diegiate naują vendor'į)

Kiekvienam naujam vendor'iui:

- [ ] Account'o email = longrein.team@gmail.com
- [ ] Slaptažodis sugeneruotas Bitwarden'e (16+ simbolių, random)
- [ ] Slaptažodis išsaugotas Bitwarden vault'e su URL ir notes
- [ ] 2FA įjungta per Authenticator app (NE SMS)
- [ ] Backup codes (jei vendor'is duoda) print'inti ir saugomi
- [ ] Recovery email patikrintas (longrein.team@gmail.com)
- [ ] Eilutė pridėta į `Longrein-Vendor-Accounts-Tracker.xlsx`
- [ ] (Opcionalu) Pridėta `06_Ops/Vendor-Notes/` folder'yje žinutė apie tą vendor'ių

5 min per vendor'į. Skip'inant — pirmas pažeidimas nuves į stiprų gailesti.

---

## 10. The one rule above all

**„Jei abejoji — sustok ir patikrink, prieš įvesdama slaptažodį."**

Phishing'o el. paštas atrodo kaip Stripe? Eik į stripe.com tiesiogiai per Bitwarden auto-fill, NEKLIKINK link'o email'e.
Vendor'is paprašė „pakartotinai patvirtinti" slaptažodį per chat? STOP. Vendor'iai NIEKADA neklausia slaptažodžio.
Klientas atsiuntė failą su .exe extensija? STOP. Verslo klientai siunčia .pdf, .docx, .xlsx — niekada .exe.

Šita viena taisyklė padės tau išvengti 90% atakų, į kurias patenka kiti founder'iai.

---

*Šis playbook'as live'as. Atnaujinti, kai keičiasi vendor'ių sąrašas, team'as auga, įvyksta incidentai. Įkelk į Drive `06_Ops/` folder'į.*
