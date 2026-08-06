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

### 3.1 Pritaikyti migraciją (BŪTINA)

Supabase → SQL Editor → įklijuoti ir paleisti visą
`database/110_personal_dashboard.sql`. Idempotentiška, saugu kartoti.

### 3.2 Įsileisti save (BŪTINA)

Ta pati SQL konsolė, pakeisk el. paštą savo prisijungimo adresu:

```sql
insert into dashboard_access (auth_user_id, label)
select id, 'Andreja — personal command centre'
  from auth.users
 where email = 'TAVO@EL.PASTAS'
on conflict (auth_user_id) do update set enabled = true;
```

Patikrink, kad grąžino 1 eilutę. Jei 0 — el. paštas nesutampa su
`auth.users`.

### 3.3 AI patarėjas (nebūtina, bet tai pagrindinė funkcija)

Vercel → Settings → Environment Variables:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Kol jo nėra, „Ką siūlau šiandien" rodo tvarkingą tuščią būseną. Modelis —
`claude-opus-5`, viena generacija per dieną (unikalus indeksas
`(auth_user_id, generated_on)`), tad puslapio perkrovimai nekainuoja.

### 3.4 Instagram / Facebook (nebūtina)

`/personal/nustatymai`. Reikia Instagram **Business** paskyros, susietos su
Facebook puslapiu, ir ilgalaikio tokeno su `instagram_basic` +
`instagram_manage_insights`. Kelias: developers.facebook.com → programa →
Graph API Explorer → pasirink puslapį → generuok → keisk į ilgalaikį.

tjk.lt veikia iš karto — WP REST API viešas, tokeno nereikia.

### 3.5 Gmail rytinė santrauka (nebūtina)

Vercel aplinkos kintamasis:

```
PERSONAL_BRIEFING_SECRET=<ilga atsitiktinė eilutė>
```

Tada `tjk-daily-inbox-check` užduotis turi POST'inti į
`https://app.longrein.eu/api/personal/briefing`:

```
Authorization: Bearer <PERSONAL_BRIEFING_SECRET>
Content-Type: application/json

{ "briefing_on": "2026-08-07",
  "summary": "3 nauji laiškai reikalauja atsakymo…",
  "items": [ { "title": "Sutartis iš X", "urgency": "high" } ] }
```

Kol paslapties nėra, endpoint'as grąžina 404 — jo tarsi nėra.

### 3.6 Longrein planų kainos (nebūtina)

`/personal/nustatymai` → „Longrein planų kainos". Be jų MRR kortelė lieka
tuščia. Sąmoningai: kodo bazėje nėra patikimo plano→kainos žemėlapio
(Stripe kainos aplinkos kintamuosiuose, Founding Members apmokestinami
rankiniu būdu, FREE_MODE įjungtas). Geriau tuščia negu išgalvota.

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

### Veikia po papildomos konfigūracijos

| Sritis | Ko reikia |
|---|---|
| AI patarėjas | `ANTHROPIC_API_KEY` |
| Instagram / Facebook metrikos | tokenai nustatymuose |
| Gmail santrauka | `PERSONAL_BRIEFING_SECRET` + užduoties POST |
| MRR | planų kainos nustatymuose |

### Neveikia — sąmoningai palikta tuščia

| Sritis | Kodėl |
|---|---|
| **Uptime / klaidų dalis** | Kodo bazėje **nėra** nei Sentry, nei APM, nei klaidų lentelės. Nėra iš ko skaičiuoti. Kortelė sako tai atvirai, o ne rodo 99,9 %. |
| **Push siuntimas** | Service worker'is paruoštas; planuoklio nėra. |
| **Founding Members skaitiklis** | DB nėra FM lentelės. Vietoj to — tikslas „Naujos Longrein arklidės", kuris skaičiuoja realias arklides. |
| **Google Analytics** | Neprijungtas. `NEXT_PUBLIC_GA_ID` egzistuoja, bet GA Data API integracijos nėra. |

---

## 6. Kiti darbai

1. **Push siuntimo planuoklis** — cron, kuris ryte siunčia santrauką per
   esamą `lib/push/send.ts`. Reikia VAPID raktų (jau numatyti kode).
2. **Sentry** — prijungti prie Longrein, tada užpildyti uptime kortelę.
3. **Socialinių metrikų cron** — dabar atnaujinama mygtuku; dienos cron
   padarytų duomenis šviežius be jos veiksmo.
4. **GA4 Data API** — tjk.lt lankomumui.
5. **Planšetės išdėstymas** — dabar optimizuota iPhone; platesniuose
   ekranuose turinys tiesiog centruojasi ties 560 px.

---

## 7. Testai

```bash
npm test
```

Node įtaisytas testų vykdyklis + natyvus TypeScript tipų nulupimas. Jokių
naujų priklausomybių. 32 testai dengia „nejojo 2 sav" ribą, tempo
skaičiavimą, prognozes, laiko juostų / vasaros laiko aritmetiką ir turinio
spragas.

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
database/110_personal_dashboard.sql     visos dashboard_* lentelės, RLS, view
lib/personal/access.ts                  prieigos vartai (fail-closed)
lib/personal/integrations.ts            Instagram / Facebook / WP klientai
services/personalDashboard/
  core.pure.ts                          gryna logika (vienintelė testuojama)
  common.ts                             laiko juosta, safe(), bendra
  tjk.ts  finance.ts  longrein.ts       ekranų duomenys
  marketing.ts  goals.ts  briefing.ts
  advisor.ts                            Claude kvietimas + kešavimas
  settings.ts                           tokenų saugojimas (server-only)
  __tests__/core.pure.test.ts           32 testai
app/personal/                           layout, 6 ekranai, nustatymai, actions
app/personal-offline/                   offline atsarginis puslapis
app/api/personal/briefing/route.ts      Gmail santraukos priėmimas
components/personal/                    navigacija, UI primityvai, formos
public/sw-personal.js                   service worker (sritis /personal/)
```
