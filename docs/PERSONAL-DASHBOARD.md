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

### 3.4 Instagram / Facebook — prijungimas vienu mygtuku

`/personal/nustatymai` → „Instagram ir Facebook". Reikia Instagram
**Business** paskyros, susietos su Facebook puslapiu.

Forma prašo trijų dalykų ir toliau viską padaro pati: trumpalaikį tokeną
pakeičia ilgalaikiu, per `/me/accounts` susiranda puslapį, iš jo ištraukia
**Page Access Token** ir prikabintą **Instagram Business ID**, ir abu
įrašo. Rankomis konstruoti Graph API URL su app secret nebereikia — tai
buvo pati klaidingiausia vieta.

Ko reikia iš `developers.facebook.com`:

1. **App ID** ir **App Secret** — programos Settings → Basic.
2. **Trumpalaikis tokenas** — Tools → Graph API Explorer → pasirink
   programą → Generate Access Token.
3. Teisės, kurias reikia pažymėti generuojant:
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `instagram_basic`, `instagram_content_publish`,
   `instagram_manage_insights`.

**App Secret neįrašomas.** Jis naudojamas tik mainams ir po to
išmetamas — laikyti be reikalo būtų nereikalinga rizika.

Gautas **puslapio tokenas nebesibaigia** (skirtingai nuo 60 d. vartotojo
tokeno) tol, kol nekeiti Facebook slaptažodžio ir neatšauki programos
teisių. Jei vis dėlto nustotų veikti — Marketing ekranas parodys
„greičiausiai pasibaigęs tokenas", ir formą užpildai iš naujo.

**Dėl `instagram_content_publish` App Review:** kol programa yra
„Development" režime, ji veikia be peržiūros **tavo pačios** paskyrai —
tau kaip programos administratorei. Peržiūros reikia tik tada, jei
programa būtų skirta kitiems žmonėms. Mums nereikia.

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

### 3.7 Tikslai

`/personal/tikslai`. Pirmą kartą atidarius sukuriami trys pradiniai
tikslai (3000 €/mėn., 20 treniruočių/sav., 3 įrašai/sav.) — juos galima
keisti ar ištrinti; ištrinti nebegrįžta.

Kiekviena kortelė rodo tris dalykus, ne vieną:

| | |
|---|---|
| **Kur esi** | juosta + skaičius |
| **Kur turėtum būti** | plona linija juostoje = tolygus tempas |
| **Kuo tai baigsis** | prognozė ir kiek reikia per dieną |

Trečias yra svarbiausias. Juosta mėnesio 14 d. guodžia, bet nieko
nepasako; „tokiu tempu liks 2000 € iš 3000 €, reikia po 100 € per dieną,
liko 10 dienų" — jau sprendimas šiai popietei.

Prognozė sąmoningai **netaikoma** pirmam laikotarpio dešimtadaliui: 500 €
antrą mėnesio dieną ekstrapoliuotųsi į 7500 €, ir kortelė meluotų.

Matuojami rodikliai: pajamos, įvykusios treniruotės, nauji klientai,
**klientų sugrįžtamumas** (per 30 d.), **Instagram sekėjų prieaugis**,
**paskelbti įrašai**, Longrein arklidės ir laukiantieji.

Sugrįžtamumas skaičiuojamas tik tiems klientams, kurių 30 d. langas jau
pasibaigęs — kitaip vakar jojęs žmogus kas dieną temptų procentą žemyn ir
rodiklis matuotų ne lojalumą, o tai, kaip neseniai prasidėjo laikotarpis.

Sekėjų prieaugiui reikia **dviejų matavimų**. Meta grąžina tik dabartinį
skaičių, tad kasdien įrašomas momentinis kiekis (per rytinį cron ir per
Rinkodaros „Atnaujinti"). Pirmą dieną kortelė sako „nėra iš ko
skaičiuoti", ne „+0".

### 3.9 Skelbimai į socialinius tinklus

`/personal/social`. Rašai vieną kartą — išeina į Instagram, Instagram
Story ir Facebook.

- **Nuotrauka/video** keliama tiesiai iš telefono į Supabase Storage
  (`personal-social`). Meta pati parsisiunčia failą iš to viešo adreso —
  todėl bucket'as viešas skaitymui. Rašyti į jį gali tik tu.
- **„Parašyk už mane"** — Claude parašo tekstą TJK balsu (lietuviškai,
  dalykiškai, be „nepraleisk progos!!!"), su grotažymėmis.
- **Suplanuoti** — pasirenki laiką, ir GitHub Actions kas 5 min. paima,
  kas jau pribrendo.
- **Dalinė sėkmė matoma.** Jei Instagram pavyko, o Facebook ne, įrašas
  pažymimas „dalinai", matai kurioje platformoje kas nutiko, ir
  „Bandyti dar kartą" **nebesiunčia** ten, kur jau nuėjo.

Instagram be nuotraukos neleidžia — tai jų API riba, ne mūsų. Composer'is
pasako iš karto, o ne per nesėkmingą paskelbimą 7 val. ryto.

Ką reikia žinoti: Instagram Story tekstą ignoruoja (jų API tokio lauko
neturi), o video Instagram apdoroja asinchroniškai — jei per 90 s
nespėja, įrašas lieka eilėje ir kitas praėjimas jį pabaigia.

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
npm test                               # 74 vienetiniai testai (grynoji logika)
npm run build && npm run test:routes   # 30 maršrutų patikrų
```

Node įtaisytas testų vykdyklis + natyvus TypeScript tipų nulupimas. Jokių
naujų priklausomybių. 74 testai dengia „nejojo 2 sav" ribą, tempo
skaičiavimą, prognozes, laiko juostų / vasaros laiko aritmetiką, turinio
spragas, veikimo laiko skaičiavimą (įskaitant „spraga = gedimas" ir
„pirmoji diena nerodo 4 %"), MRR normalizavimą, savaičių ribas
(sekmadienis priklauso prieš tai prasidėjusiai savaitei, o 21:30 UTC
sekmadienį Vilniuje jau kita savaitė) ir tikslų prognozes (ankstyvas
šuolis neekstrapoliuojamas, „trūksta" niekada nerodo neigiamo skaičiaus).

`test:routes` paleidžia **produkcinį build'ą** ir tikrina, ką vienetinis
testas patikrinti negali: kad visi 8 `/personal` ekranai anonimui grąžina
404 (ne 403 ir ne 500), kad asmeniniai API endpoint'ai neįsileidžia be
autentikacijos, kad viešas skelbimų praėjimas be autentikacijos nieko
nepaskelbia, kad `/api/health` atsako teisingai, ir kad produkto
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
database/112_personal_social_and_goals.sql  skelbimų eilė, media, savaitės
database/APPLY_PERSONAL_DASHBOARD.sql    vienas įklijavimas + patikros
lib/personal/access.ts                   prieigos vartai (fail-closed)
lib/personal/integrations.ts             Instagram / Facebook / WP skaitymas
lib/personal/publish.ts                  Meta skelbimas + tokenų mainai
lib/personal/push.ts                     VAPID raktai + Web Push siuntimas
lib/personal/error-log.ts                klaidų įrašymas (be asmens duomenų)
services/personalDashboard/
  core.pure.ts                           gryna logika (testuojama)
  ops.pure.ts                            uptime + MRR aritmetika (testuojama)
  social.ts                              eilė, skelbimas, AI tekstai
  common.ts                              laiko juosta, safe(), bendra
  tjk.ts  finance.ts  longrein.ts        ekranų duomenys
  marketing.ts  goals.ts  briefing.ts
  mrr.ts                                 Stripe MRR
  foundingMembers.ts                     FM sąrašas
  advisor.ts                             Claude kvietimas + kešavimas
  settings.ts                            tokenai + aplinkos kintamųjų sluoksnis
  __tests__/                             52 testai
app/personal/                            layout, 7 ekranai, nustatymai, actions
app/personal/social/                     kūrimas, planavimas, istorija
app/personal/social-actions.ts           skelbimo veiksmai + Meta prijungimas
app/personal/error.tsx                   ekrano klaidų gaudyklė
app/error.tsx                            viso produkto klaidų gaudyklė
app/personal-offline/                    offline atsarginis puslapis
app/api/health/route.ts                  viešas health check (uptime šaltinis)
app/api/personal/briefing/route.ts       Gmail santraukos priėmimas
app/api/personal/push/subscribe/route.ts prenumerata / atsisakymas
app/api/personal/push/daily/route.ts     rytinis siuntimas (Vercel cron)
components/personal/                     navigacija, UI primityvai, formos
components/personal/enable-push.tsx      pranešimų įjungimas (iOS būsenos)
components/personal/composer.tsx         įrašo kūrimas + media įkėlimas
components/personal/post-row.tsx         įrašo eilutė + pakartotinis siuntimas
public/sw-personal.js                    service worker (sritis /personal/)
scripts/smoke-personal.mjs               maršrutų testas
.github/workflows/health-check.yml       kas 5 min. tikrina /api/health
.github/workflows/social-publish.yml     kas 5 min. siunčia suplanuotus įrašus
```

---

## 9. Kodėl skelbimai per GitHub Actions, o ne Vercel cron

Vercel Hobby leidžia **du** cron darbus. Abu užimti: treniruočių
priminimai 06:00 ir rytinis pranešimas 05:00. Trečias įrašas
`vercel.json` faile sugriautų patį diegimą.

Todėl skelbimų praėjimas gyvena GitHub Actions, kaip ir veikimo patikra.
Endpoint'as apsaugotas ne slaptažodžiu, o **konstrukcija**: jis paskelbia
tik tuos įrašus, kuriuos tu pati suplanavai, ir tik atėjus jų laikui;
kūrimo ar keitimo per jį padaryti neįmanoma; dvigubą siuntimą neleidžia
eilės „pasisavinimas" (`scheduled` → `publishing`) ir `external_ids`
žymos. Nustačius `CRON_SECRET` apsauga sugriežtėja iki bearer tokeno —
tai pagerinimas, ne būtina sąlyga.

Priežastis, kodėl ne slaptažodis iš karto: GitHub Actions darbas be
sukonfigūruoto slapto rakto gautų 401 kas 5 minutes ir siųstų po laišką
apie nesėkmę. Būtent dėl to `cron-reminders.yml` iki šiol išjungtas.
