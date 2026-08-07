# Asmeninė valdymo lenta (`/personal`)

Privati Andrėjos kasdienė lenta: TJK operacijos, finansai, Longrein
sveikata, rinkodara, tikslai ir kasdienis AI patarėjas. Gyvena Longrein
kodo bazėje, bet yra visiškai atskira nuo produkto.

**Šis dokumentas — perdavimo instrukcija.** Skiltis „Ką reikia padaryti
ranka" yra svarbiausia: be jos lenta atsidarys kaip 404.

---

## 1. Kodėl `/personal`, o ne `/dashboard/personal`

Buvo prašyta `/dashboard/personal`. Neįmanoma padaryti gerai: viską po
`/dashboard/*` apgaubia `app/dashboard/layout.tsx`, kuris pieši Longrein
šoninę juostą, „welcome tour", komandų paletę ir „report problem" mygtuką.
Next.js App Router **neleidžia** vaikiniam maršrutui atsisakyti tėvinio
layout'o. Vienintelis būdas gauti švarų viso ekrano PWA ten būtų redaguoti
bendrą dashboard layout'ą — t. y. paliesti **kiekvieno** esamo Longrein
puslapio piešimo kelią. Būtent to buvo prašyta išvengti.

`/personal` yra `/dashboard` brolis: savas layout'as, savas manifest'as,
sava service worker'io sritis. Su produktu dalijasi tik Supabase klientu ir
dizaino žetonais. Viso dalyko pašalinimas = `rm -rf app/personal` plius
migracijos 110 apačioje esantis (užkomentuotas) teardown blokas.

Šalutinis privalumas: `/personal` nepatenka į middleware prenumeratos
patikrą, o tai teisinga — tai vidinis įrankis, ne apmokama vieta.

---

## 2. Prieiga ir „išjungimo" jungiklis

Prieigą valdo lentelė `dashboard_access` — **ne** aplinkos kintamasis.

- Tuščia lentelė = niekas neturi prieigos. Būtent taip tai ir išsiunčiama.
- Neįtrauktas naudotojas gauna **404**, ne 403 (403 patvirtintų, kad
  maršrutas egzistuoja).
- Ta pati `dashboard_is_allowed()` funkcija yra kiekvienos `dashboard_*`
  lentelės RLS politikoje, tad prieigos atšaukimas nukerta ir duomenis, ne
  tik sąsają.
- Klaida ar DB triktis lemia **uždarymą** (404), ne atidarymą.

**Išjungti bet kada, be perdiegimo — viena SQL eilutė:**

```sql
update dashboard_access set enabled = false where auth_user_id = '<id>';
```

Įsigalioja nuo kitos užklausos. Vercel aplinkos kintamojo keitimas to
negalėtų — jam reikia naujo diegimo.

---

## 3. KĄ REIKIA PADARYTI RANKA

Be 3.1 ir 3.2 lenta neveiks.

### 3.1 + 3.2 Migracijos ir prieiga (BŪTINA — vienas įklijavimas)

Supabase → SQL Editor → New query. Įklijuok ir paleisk **iš eilės**:

1. `database/110_personal_dashboard.sql`
2. `database/111_personal_dashboard_ops.sql`
3. `database/APPLY_PERSONAL_DASHBOARD.sql` ← įsileidžia tave

Trečias failas pabaigoje išspausdina dvi patikros lenteles. Pirmoje visos
eilutės turi būti `ok`; antroje — lygiai viena eilutė su tavo el. paštu.
Jei antroji tuščia, el. paštas nesutampa su tuo, kuriuo jungiesi prie
Longrein.

Viskas idempotentiška — kartoti saugu, nieko esamo nekeičia.

### 3.3 AI patarėjas (nebūtina, bet tai pagrindinė funkcija)

**Paprasčiausias būdas:** `/personal/nustatymai` → „Asistentė (Claude)" →
įklijuok raktą iš `console.anthropic.com` → API keys → Create key. Veikia
iškart, be perdiegimo.

Alternatyva (jei kada turėsi prieigą prie Vercel): aplinkos kintamasis
`ANTHROPIC_API_KEY`. Aplinkos kintamasis naudojamas tik tada, kai
nustatymuose nieko neįvesta — įvestas raktas visada laimi.

Modelis — `claude-opus-5`, viena generacija per dieną (unikalus indeksas
`(auth_user_id, generated_on)`), tad puslapio perkrovimai nekainuoja.

### 3.4 Instagram / Facebook (nebūtina)

`/personal/nustatymai`. Reikia Instagram **Business** paskyros, susietos su
Facebook puslapiu.

Kaip gauti tokeną (Meta):

1. `developers.facebook.com` → My Apps → Create App → tipas **Business**
2. Pridėk produktą **Facebook Login for Business**
3. Tools → **Graph API Explorer** → pasirink savo programą ir puslapį
4. Teisės: `instagram_basic`, `instagram_manage_insights`,
   `pages_read_engagement`, `pages_show_list`
5. Generate Access Token → nukopijuok
6. Tools → **Access Token Debugger** → įklijuok → *Extend Access Token*
   (trumpalaikis galioja 1–2 val., ilgalaikis ~60 d.)
7. Instagram paskyros ID: Graph API Explorer užklausa
   `me/accounts?fields=instagram_business_account`

Ilgalaikis tokenas galioja apie 60 dienų, tad kartą per du mėnesius jį
reikės perklijuoti. Marketing ekranas tada parodys „greičiausiai pasibaigęs
tokenas" — tai ir yra priminimas.

Alternatyva per aplinkos kintamuosius: `META_IG_USER_ID`,
`META_INSTAGRAM_ACCESS_TOKEN`, `META_PAGE_ID`, `META_FB_PAGE_ACCESS_TOKEN`.

tjk.lt veikia iš karto — WP REST API viešas, tokeno nereikia.

### 3.5 Gmail rytinė santrauka (nebūtina)

`/personal/nustatymai` → „Pašto santrauka" → sugalvok ilgą atsitiktinį
tekstą ir įrašyk. (Arba `PERSONAL_BRIEFING_SECRET` Vercel'e.)

Tada `tjk-daily-inbox-check` užduotis turi POST'inti į
`https://app.longrein.eu/api/personal/briefing`:

```
Authorization: Bearer <ta pati paslaptis>
Content-Type: application/json

{ "briefing_on": "2026-08-07",
  "summary": "3 nauji laiškai reikalauja atsakymo…",
  "items": [ { "title": "Sutartis iš X", "urgency": "high" } ] }
```

Kol paslapties nėra, endpoint'as grąžina 404 — jo tarsi nėra.

### 3.6 MRR (nebūtina)

Du šaltiniai, geresnis pirmas:

1. **Stripe** — jei nustatytas `STRIPE_SECRET_KEY`, MRR imamas tiesiai iš
   aktyvių prenumeratų. Visi mokėjimo periodai suvedami į mėnesį (metinis
   dalinamas iš 12, ketvirtinis iš 3). Skaičiuojamos tik `active` — ne
   bandomosios ir ne vėluojančios.
2. **Rankinės kainos** — `/personal/nustatymai` → „Longrein planų kainos".
   Naudojama, kai Stripe neprijungtas. Kortelė aiškiai pasako, kad tai
   įvertis.

Jei nėra nei vieno, kortelė lieka tuščia. Geriau tuščia negu išgalvota.

### 3.8 Rytiniai pranešimai į telefoną (rekomenduoju)

`/personal/nustatymai` → „Rytiniai pranešimai" → **Įjungti**.

Svarbu iOS: pranešimai veikia **tik** tada, kai programėlė pridėta į
pradinį ekraną (žr. 4 skyrių). Safari kortelėje mygtukas tai pasakys.

VAPID raktai sugeneruojami automatiškai per pirmą įjungimą ir įrašomi į
`dashboard_integration_settings`. Nieko konfigūruoti nereikia. Siuntimą
vykdo Vercel cron `0 5 * * *` (UTC) — 8:00 Vilniuje vasarą, 7:00 žiemą.
Siuntimas idempotentiškas per parą: antras kvietimas tą pačią dieną nieko
nesiunčia.

### 3.7 Tikslai (nebūtina, bet rekomenduoju)

`/personal/tikslai`. Be mėnesio pajamų tikslo Finansai rodo faktą, bet
negali pasakyti, ar jo pakanka.

---

## 4. Įsidėti į iPhone pradžios ekraną

1. **Safari** (ne Chrome — „Add to Home Screen" ten neveikia taip pat).
2. Eik į `https://app.longrein.eu/personal` ir prisijunk.
3. Apatinėje juostoje — mygtukas **Share** (kvadratas su rodykle).
4. Slink žemyn → **Add to Home Screen**.
5. Pavadinimas jau bus „Andrėja" — spausk **Add**.

Gausi tamsiai žalią „A" ikoną, atskirą nuo Longrein „L." Atidaryta ji
veikia per visą ekraną, be Safari juostų.

**Jei prašo prisijungti kas kartą:** iOS standalone PWA turi atskirą
slapukų saugyklą nuo Safari. Prisijunk vieną kartą jau pačioje
programėlėje — sesija išliks.

**Push pranešimai:** techninė dalis paruošta (service worker'is turi push
ir notificationclick tvarkykles), bet **niekas jų dar nesiunčia**. iOS
leidžia web push tik pridėjus į pradžios ekraną (iOS 16.4+). Realus
siuntimas — atskiras darbas, žr. 6 skiltį.

---

## 5. Kas iš tikrųjų veikia su realiais duomenimis

Sąžininga inventorizacija.

### Veikia iš karto po 3.1 ir 3.2

| Sritis | Šaltinis |
|---|---|
| Šios dienos ir artimiausios treniruotės | `lessons` |
| Klientų sugrąžinimo sąrašas (≥14 d.) | `dashboard_client_last_ride` |
| Rezervacijų užklausos | `lesson_requests` |
| Darbai / priminimai | `reminders` |
| Mėnesio pajamos, skolos, prognozės | `billable_items` (mig. 105) |
| Tikslų progresas | `dashboard_goals` + gyvi skaičiavimai |
| Longrein augimas (arklidės, vartotojai, laukiantieji, prenumeratos) | `stables`, `profiles`, `waitlist_signups`, `subscriptions`, `audit_log` |
| tjk.lt įrašai | WP REST API (patikrinta gyvai) |

| Veikimo laikas ir klaidos | `dashboard_health_checks`, `dashboard_errors` |
| Founding Members | `founding_members` (sąrašas pildomas ranka Longrein ekrane) |

**Veikimo laiko kortelė** užsipildo maždaug per 5 min. po pirmo deploy:
GitHub Actions darbas „Uptime probe" kas 5 minutes kviečia `/api/health`,
kuris atlieka tikrą užklausą į duomenų bazę ir įrašo rezultatą.

Procentas skaičiuojamas ne „kiek įrašų sako ok", o **kiek patikrų atėjo iš
tiek, kiek turėjo ateiti**. Skirtumas esminis: kai svetainė neveikia, ji
neįrašo nieko, tad pirmasis būdas visą gedimą rodytų ramų 100 %. Neatėjusi
patikra ir yra gedimo įrašas.

### Veikia po papildomos konfigūracijos

| Sritis | Ko reikia |
|---|---|
| AI patarėjas | Claude raktas nustatymuose (arba `ANTHROPIC_API_KEY`) |
| Instagram / Facebook metrikos | tokenai nustatymuose (arba `META_*`) |
| Gmail santrauka | paslaptis nustatymuose + užduoties POST |
| Rytiniai pranešimai | įjungti nustatymuose; iOS — būtina pridėti į pradinį ekraną |
| MRR iš Stripe | `STRIPE_SECRET_KEY` (kitaip — rankinės kainos) |

### Neveikia — sąmoningai palikta tuščia

| Sritis | Kodėl |
|---|---|
| **Google Analytics** | Neprijungtas. `NEXT_PUBLIC_GA_ID` egzistuoja, bet GA Data API integracijos nėra. |
| **Klaidų dalis procentais** | Rodomas klaidų **skaičius** per 24 h ir 7 d., ne procentas. Procentui reikėtų užklausų skaitiklio, kurio šioje architektūroje nėra — vardiklio išgalvojimas paverstų skaičių beprasmiu. |

---

## 6. Kiti darbai

1. **Socialinių metrikų cron** — dabar atnaujinama mygtuku; dienos cron
   padarytų duomenis šviežius be jos veiksmo. (Vercel Hobby leidžia 2 cron
   darbus, abu jau užimti — reikėtų GitHub Actions arba Pro plano.)
2. **GA4 Data API** — tjk.lt lankomumui.
3. **Ilgalaikio Meta tokeno automatinis atnaujinimas** — dabar kas ~60 d.
   reikia perklijuoti ranka.
4. **Planšetės išdėstymas** — dabar optimizuota iPhone; platesniuose
   ekranuose turinys tiesiog centruojasi ties 560 px.
5. **Klaidų pranešimo endpoint'as** neturi sesijos reikalavimo (klaidų
   gaudyklė turi veikti ir tada, kai lūžusi autentikacija). Yra
   apkarpymas ir greitaeigis limitas, bet skaičius vertintinas kaip
   signalas, ne kaip auditas.

---

## 7. Testai

```bash
npm test                    # 52 vienetiniai testai (grynoji logika)
npm run build && npm run test:routes   # 24 maršrutų patikros
```

Node įtaisytas testų vykdyklis + natyvus TypeScript tipų nulupimas. Jokių
naujų priklausomybių. 52 testai dengia „nejojo 2 sav" ribą, tempo
skaičiavimą, prognozes, laiko juostų / vasaros laiko aritmetiką, turinio
spragas, veikimo laiko skaičiavimą (įskaitant „spraga = gedimas" ir
„pirmoji diena nerodo 4 %") ir MRR normalizavimą.

`test:routes` paleidžia **produkcinį build'ą** ir tikrina, ką vienetinis
testas patikrinti negali: kad visi 7 `/personal` ekranai anonimui grąžina
404 (ne 403 ir ne 500), kad asmeniniai API endpoint'ai neįsileidžia be
autentikacijos, kad `/api/health` atsako teisingai, ir kad produkto
puslapiai (`/login`, `/signup`, `/dashboard`, `/api/keepalive`) nesulūžo.

**Ko šis testas nedaro:** netikrina prisijungusio vartotojo 200 su
atvaizduotomis kortelėmis. Tam reikėtų tikros Supabase sesijos — arba
apsimetant ja per service-role raktą, arba sukuriant testinį vartotoją
produkcinėje bazėje. Nė vieno iš to testų skriptas neturėtų daryti
savavališkai, tad automatinis tikrinimas apsiriboja „vartai laiko ir niekas
nelūžta".

**Svarbu:** iki šio pakeitimo repozitorijoje **nebuvo jokio JS testų
vykdyklio** — tik pgTAP tipo SQL planai `database/tests/`. Todėl „paleisti
esamą testų rinkinį" reiškė „nėra ko paleisti"; vietoj to regresijų
patikrinimas rėmėsi tuo, kad `next build` praeina ir kad maršrutų sąrašas
prieš/po sutampa (nė vienas neišnyko).

Testuojami tik `*.pure.ts` moduliai. Visa kita liečia Supabase ir
reikalautų DB dublerio — sąmoningai neįtraukta į šią apimtį.

---

## 8. Failų žemėlapis

```
database/110_personal_dashboard.sql      dashboard_* lentelės, RLS, view
database/111_personal_dashboard_ops.sql  push, health checks, klaidos, FM
database/APPLY_PERSONAL_DASHBOARD.sql    vienas įklijavimas + patikros
lib/personal/access.ts                   prieigos vartai (fail-closed)
lib/personal/integrations.ts             Instagram / Facebook / WP klientai
lib/personal/push.ts                     VAPID raktai + Web Push siuntimas
lib/personal/error-log.ts                klaidų įrašymas (be asmens duomenų)
services/personalDashboard/
  core.pure.ts                           gryna logika (testuojama)
  ops.pure.ts                            uptime + MRR aritmetika (testuojama)
  common.ts                              laiko juosta, safe(), bendra
  tjk.ts  finance.ts  longrein.ts        ekranų duomenys
  marketing.ts  goals.ts  briefing.ts
  mrr.ts                                 Stripe MRR
  foundingMembers.ts                     FM sąrašas
  advisor.ts                             Claude kvietimas + kešavimas
  settings.ts                            tokenai + aplinkos kintamųjų sluoksnis
  __tests__/                             52 testai
app/personal/                            layout, 6 ekranai, nustatymai, actions
app/personal/error.tsx                   ekrano klaidų gaudyklė
app/error.tsx                            viso produkto klaidų gaudyklė
app/personal-offline/                    offline atsarginis puslapis
app/api/health/route.ts                  viešas health check (uptime šaltinis)
app/api/personal/briefing/route.ts       Gmail santraukos priėmimas
app/api/personal/push/subscribe/route.ts prenumerata / atsisakymas
app/api/personal/push/daily/route.ts     rytinis siuntimas (Vercel cron)
components/personal/                     navigacija, UI primityvai, formos
components/personal/enable-push.tsx      pranešimų įjungimas (iOS būsenos)
public/sw-personal.js                    service worker (sritis /personal/)
scripts/smoke-personal.mjs               maršrutų testas
.github/workflows/health-check.yml       kas 5 min. tikrina /api/health
```
