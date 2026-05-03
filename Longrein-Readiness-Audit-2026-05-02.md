# Longrein — Pasirengimo 10 Founding Members auditas

**Data:** 2026-05-02 (2 dienos po 30 balandžio audit'o, 4 dienos po active dev sesijos)
**Klausimas, į kurį atsako šis dokumentas:** Ar appsa yra pasirengusi išsiųsti 10 personalizuotų email'ų žirgynams kitą savaitę su pasiūlymu nemokamai testuoti 12 mėn. mainais į feedback'ą?
**Trumpas atsakymas:** TAIP, bet su 2–3 savaičių paruošimo darbu. NE šiandien.

---

## TL;DR — pagrindinė esmė

Per 2 dienas nuo paskutinio audit'o tu (per dev'ą) pataisei **tris kritines klaidas**, kurios anksčiau buvo blocker'iai:

1. ✅ Stripe biblioteka įdiegta (nors checkout flow dar neparašytas)
2. ✅ Waitlist forma TIKRAI rašo į Supabase (nebe `alert()` triukas)
3. ✅ In-app dashboard'as perdažytas iš Navy/Orange į Paddock Green / Saddle Tan / Cream — VISIBILITY BRAND CONSISTENCY pasiekta

Tai TIKRAI didelis darbas, ir jis yra padarytas teisinga eile. Trys naujos DB migracijos (subscription scaffolding, lesson series, stable features) — visa tai mėn. 30 audit'o priority list iš viršaus.

**Kas dar trūksta priklauso nuo to, kuriuo keliu eini:**

- **Free Founding Members kelias (tavo dabartinis sprendimas):** 2–3 sav. darbo iki launch'o. Stripe NEREIKIA — visi 10 ant nemokamo plan'o per 12 mėn. Kritiniai blocker'iai: GDPR puslapiai, LT lokalizacija, email infra, mobile dogfood, brand rename Hoofbeat → Longrein.
- **Pilnas mokamas launch'as:** +2 sav. virš to (Stripe checkout + webhook + UI). Iš viso 4–5 sav.

Mano rekomendacija — laikytis **Founding Members kelio**. Tai sutampa su tavo pačios sprendimu, nedaromi nereikalingi rizikingi pinigai, ir Stripe užbaigsim po pirmų 5 patenkintų founding members feedback'o.

---

## Dalis 1 — Kas veikia (paruošta 10 founding members šiandien)

Šie moduliai yra brandūs, RLS-protected, ir gali būti naudojami iš pirmos dienos:

### Core daily workflow

- **Calendar** — week + day views, drag-to-reschedule, owner role mato viską, employee mato savo, client mato savo. Postgres GIST exclusion constraint'ai duomenų bazės lygmenyje neleidžia žirgo arba treneerio dvigubo booking'o (production-grade kokybės signalas).
- **Horse profiles** — sticky hero, 4 tabs (Overview / Sessions / Health / Boarding), KPI strip, activity ring, heatmap, training breakdown. Gilesnis nei Equine Genie.
- **Sessions log** — quick-add bottom sheet (When / Rider / Type / Duration), inline note editor. Sessions feed welfare workload (sąmoningas atskyrimas nuo billable lessons).
- **Health & care records** — vakcinacijos, farrier, vet timeline su statuso kortelėmis. Add record popover, resolve injury, delete record.
- **Welfare dashboard** — 5-bucket counter strip (Over cap / Near cap / Resting / Steady / Light) su per-horse load %. **Tai tavo wedge feature'as. JOKS US konkurentas neturi šito kaip viršutinio nav item'o.**

### Client management

- **Clients CRUD** — visas info, edit, paketai, sutartys (agreements panel), client charges (recurring boarding charges).
- **Lesson packages** — 10-pack / 20-pack tracking, balance per client.
- **Client portal (read-only)** — `/dashboard/my-lessons`, `/my-payments`, `/my-horses`, `/my-sessions`. Lūžtanti dalis — NĖRA self-booking, klientai negali užsisakyti pamokos patys (audit pažymi tai kaip „brochure, not tool" — bet for 10 founding members, OK).

### Money

- **Payments** (recorded — owner žymi gautus pinigus rankomis)
- **Expenses** (tracking)
- **Finance dashboard** — KPI strip
- **Per-horse profitability** — `/dashboard/horses/profitability` — pajamos iš pamokų minus išlaidos pažymėtos to žirgo. **Owner stickiness gem'as. Tai mato ne kiekvienas konkurentas.**

### Operations

- **Onboarding checklist + welcome tour** — naujiems naudotojams
- **Smart suggestions widget** — pro-active („this horse hasn't been ridden in 9 days," „this client overdue €120")
- **Smart birthday widget** — emocinis sluoksnis (instagrammable)
- **Cmd+K command palette** — premium signalas
- **Audit log** — kas keitė ką ir kada (compliance + trust)
- **Team invite flow** — multi-user yard'ams
- **Settings: import / export, MFA, feature toggles, services manager, boarding settings**
- **Reminders system** — in-app reminders panel (NE email reminder'iai dar — tik in-app)
- **Public stable page `/s/[slug]`** — jei tinkama setup'ui, kiekvienas žirgynas gauna viešą URL (book.yardname.eu stiliaus)

### Architecture

- 34 DB migracijos, RLS pilnai įgyvendintas (multi-tenant safe)
- Force RLS ant visų jautrių lentelių (sessions, horses, clients, payments, etc.)
- ~70 React komponentų
- ~30 servisų sluoksnyje
- Tipažavimas (Database type'ai = `any` šiuo metu, bet tai cosmetic technical debt)
- TypeScript compile = ŠVARUS (ką tik patikrinau)

---

## Dalis 2 — Kas neveikia / trūksta (blocker'iai 10 founding members)

### A. KRITINIAI — turi būti pataisyti PRIEŠ siunčiant pirmus 10 email'ų

#### 1. ❌ NĖRA GDPR puslapių (Terms, Privacy, Cookies)

**Status:** Nė vieno puslapio. `find app -path "*/terms*" -o -path "*/privacy*"` grąžina 0 rezultatų.

**Kodėl blocker'is:** ES įstatymais privaloma prieš renkant bet kokią asmeninę info (email, vardą, žirgo info). Tu renki kliento email, kliento vardą, kliento mokėjimų istoriją, kliento adresą — visi GDPR-protected. Be Privacy Policy ir Terms of Service tu juridiškai negali priimti ir vieno žirgyno.

**Fix:** Termly.io free generator (~30 min). Pridėk `/legal/terms`, `/legal/privacy`, `/legal/cookies` puslapius su sugeneruotu tekstu. Cookie banner footer'yje (analytics tracking).

**Effort:** 4 val. iš viso (Termly + 3 page'ai + cookie banner komponentas + footer link'ai).

---

#### 2. ❌ NĖRA LT lokalizacijos (i18n nepraturtinta)

**Status:** `next-intl` ar `react-i18next` NĖRA `package.json`. Visi UI string'ai hardcoded'inti angliškai. Greeting'as „Hi", mygtukai „Add lesson", labels „Horse", „Client", „Schedule".

**Kodėl blocker'is:** Tavo beachhead'as = LT žirgynai. Lietuvos žirgyno savininkė pamatys angliškas etiketes ir pajaus „šitas ne mums." Nesvarbu, kad ji moka anglų — tai signalizuoja, kad produktas nepritaikytas jai.

**Fix:** Du keliai —
- **Trumpas (founding members tik):** prašyk visus 10 founding members angliškoje versijoje. Pažadėk LT versiją Q3'26. Daugelis sutiks, ypač jei tu pati lietuviškai onboard'ini per Zoom.
- **Tinkamas:** įdiegti `next-intl`, perkelti string'us į `messages/en.json` + `messages/lt.json`, pridėti language toggle. Effort ~2 dienos darbo + 4 val. tau išversti.

**Mano rekomendacija:** trumpas kelias dabar (founding members angliškai), tinkamas iki public launch'o (mėn. 3).

---

#### 3. ❌ NĖRA email infrastruktūros (Resend ar pan.)

**Status:** Joks email service'as nepriprijungtas. Welcome email'ai, password reset, lesson reminders, pakvietimai į team — visi naudojami Supabase'o vidiniai email'ai (atrodo techniškai, ne brand'iškai).

**Kodėl blocker'is:** Founding member'is gauna pakvietimą per Hoofbeat domain'ą iš noreply@mail.supabase.io ar pan. — atrodo kaip technical glitch'as, ne kaip kviečiama į premium produktą. Pirmas brand kontakto taškas pažeistas.

**Fix:** Resend.com free tier (3,000 email'ai/mėn — daugiau nei pakanka 10 founding members). Connect ant longrein.eu domeno (DNS SPF/DKIM/DMARC setup'as), pakeisk Supabase Auth → Email Provider į Resend, customize email templates su brand'u.

**Effort:** 4 val. (Resend setup + DNS + Supabase config + 5 template'ų rebrand'inimas).

---

#### 4. ❌ Brand rename Hoofbeat → Longrein NIEKUR neatliktas

**Status:** Visur kode, dokumentuose, migrate komentaruose, `package.json`, `app/manifest.ts`, brand colors klasėse (`brand-*`), CSS variables, README, audit dokumentai — vis dar „Hoofbeat".

**Kodėl blocker'is:** Founding members gaus pakvietimą su nuoroda į longrein.eu, prisiloggins į appsą, kuri vadinama Hoofbeat. Trust killer'is iš pirmos sekundės.

**Fix:** Globalus rename per kodą + dokumentus. Find-and-replace nedirbs aklai (kai kurie „hoofbeat" yra database table name'uose, kuriuos negalima keisti be migracijos). Reikia atidžiai:
- `app/manifest.ts` (PWA name)
- `app/layout.tsx` (HTML title, meta tags)
- All `<title>` tags
- README files
- HTML landing files (`Hoofbeat-Waitlist-Landing.html` → `Longrein-Waitlist-Landing.html`)
- Brand foundation .docx
- Launch playbook .docx
- All `.md` files in APP folder (NEXT_STEPS, PRODUCT_BACKLOG, MASTER, LAUNCH_PLAN, LANDING_COPY, ir kt.)
- Memory files (atskirai)

**Effort:** 6–8 val. atidaus rename darbo. NEPaskubinti — vienas missed reference = brand inconsistency.

---

#### 5. ❌ Public landing PUSLAPIS NĖRA Next.js appoje

**Status:** Egzistuoja `Hoofbeat-Waitlist-Landing.html` ir `Hoofbeat-Brand-Preview.html` kaip standalone failai APP folderyje. Bet `app/page.tsx` = `redirect()` į login. Marketing site nėra Next.js appoje.

**Kodėl blocker'is:** Kai pirksi longrein.eu, reikės kažko paleisti tame domeno. Du keliai —
- **A:** Migrate landing HTML į Next.js `app/(marketing)/page.tsx` — abi appsą ir landing host'ina ta pati Vercel'io aplikacija. Pliusas — viskas vienoje vietoje, vienas deploy. Minusas — ~4 val. konvertavimas iš HTML į React.
- **B:** Host'ink HTML failą atskirai (Vercel'is gali host'inti static HTML kaip atskiras projektas). longrein.eu rodys landing, app.longrein.eu rodys appsą. Pliusas — landing nepriklauso nuo Next.js'o. Minusas — du atskiri Vercel projektai.

**Mano rekomendacija:** B (host'ink HTML kaip static atskirai). Founding members signups eis per landing'o waitlist formą (jau wired prie Supabase), o pati appsa gyvens app.longrein.eu.

**Effort:** 2 val. (Vercel setup + DNS + smoke test).

---

### B. SVARBŪS — turi būti pataisyti per 2 sav. po launch'o

#### 6. Mobile dogfood NĖRA atliktas

**Status:** Sidebar yra responsive (drawer pattern), dauguma kortelių yra responsive. Bet niekas nesako, kaip calendar week-grid atrodo telefone, ar bottom sheet'ai veikia, ar trainer'is su pirštinėm gali log'inti session'ą.

**Fix:** Tu pati 7 dienas naudoji Hoofbeat tik telefone savo žirgyne. Užrašyk visus frictions. Pataisyk top 5.

**Effort:** 1 sav. naudojimo + 2 d. pataisymų.

---

#### 7. Stripe checkout flow NEparašytas

**Status:** `lib/stripe/server.ts` = parašytas. `stripe` package'as = įdiegtas. Bet NĖRA `app/api/stripe/checkout/route.ts` ir `app/api/stripe/webhook/route.ts`. Subscription DB scaffolding (migracija 32) = paruoštas, bet nėra UI ar API, kuri naudotųsi.

**Kodėl NE blocker'is founding members'iams:** Visi 10 ant trial'o / nemokami 12 mėn. Stripe nereikia, kol nepradedi imti pinigų.

**Kada reikia:** Po pirmų 5 patenkintų founding members feedback'o (mėn. 4–6), kai išleidi Pro plan'ą publikai.

**Effort kai prireikia:** 1.5 d.

---

#### 8. Email reminders (lesson day-before) NĖRA

**Status:** Reminders system yra, bet tik in-app. Joks email send.

**Effort:** 2 d. (po Resend setup'o — punktas #3).

---

#### 9. Vet/farrier kaip first-class events NĖRA

**Status:** Health records yra, bet NE calendar entry. Vet visit nėra calendar'yje.

**Audit'o pastaba (2 dienos atgal):** „If welfare data is wrong because farrier visits are stored as 'lessons,' the wedge feature undermines its own credibility."

**Effort:** 3 d.

---

### C. NICE TO HAVE — atidedam mėn. 3+

- Client self-booking flow (request-and-approve)
- WhatsApp deep-link cancellation
- SMS reminders (Twilio integration)
- Accountant CSV/XML export (Rivilė, Centas)
- PWA install + offline mode
- Photo upload per session
- Weekly digest email
- Mollie integration (alternative to Stripe — geriau SEPA-native)

---

## Dalis 3 — Ar appsa atlaikys 10 founding members apkrovą?

### Techninė apkrova

**TAIP, lengvai.** Stack — Vercel (auto-scaling) + Supabase (Pro tier'as išlaiko 100x daugiau). 10 žirgynų po ~25 arklių = 250 horse rows + ~1,000 monthly lesson rows + ~3,000 session log rows + ~500 client rows. Tai NIEKO Postgres'ui.

**Bottleneck'ai realybėje:**
- Realtime chat — jei founding members aktyviai naudosis chat'u, Supabase realtime gali būti kainavimo atžvilgiu jautrus (audit'o rekomendacija: feature-flag chat OFF default, NE marketing'inti).
- Storage — horse photos uploads. Supabase free tier'e 1GB. Su 10 yard'ų po 50 nuotraukų = OK. 50+ yard'ų = upgrade.

### UX apkrova

**ČIA didžiausia rizika.** Apkrova ne servere — apkrova TAVO laiko per onboarding ir support'ą.

10 founding members = 10× 45-min onboarding skambučių + 10 × pirmos savaitės kasdienių klausimų + 10× pirmojo mėnesio savaitinis check-in skambučių. Tai apie **60–80 valandų tavo laiko per pirmą mėnesį**, ne servero apkrova.

**Mitigacija:**
- Onboarding checklist + welcome tour jau yra (✅), bet privalo būti perBet'inta visiems atvejams
- Help center (Notion arba Mintlify) — 5–10 svarbiausių „kaip" puslapių iki launch'o
- Loom video'ai pagrindiniams flow'ams (žirgo pridėjimas, lesson booking, payment įrašymas, welfare strip skaitymas)
- Pakaitinis kanalas — WhatsApp grupė visiem 10 founding members (greitas Q&A)

---

## Dalis 4 — Realistinė launch data ir 3-savaitės sprintas

Šiandien — penktadienis, 2026-05-02.

### Trijų savaičių sprintas iki founding members launch'o (TARGET DATA: 2026-05-23)

#### Sav. 1 (5–11 gegužės) — Brand & Legal

| Kas | Effort | Kas daro |
|---|---|---|
| Hoofbeat → Longrein rename per visą code base + docs | 6–8 val. | Dev (Andreja vairuoja, dev vykdo) |
| Pirkti longrein.eu (Hostinger) | 30 min | Andreja |
| Pridėti `/legal/terms`, `/legal/privacy`, `/legal/cookies` (Termly) | 4 val. | Dev |
| Cookie banner komponentas | 2 val. | Dev |
| Founding Members ofertos šablonas | 1 val. | Andreja + aš (Claude) |
| 10-žirgynų ICP shortlist | 2 val. | Andreja |

**Sav. 1 exit criterion:** longrein.eu domain'as nupirktas. Brand rename'as 100% padarytas. GDPR puslapiai live'e. 10 žirgynų shortlist'as pasirinktas.

#### Sav. 2 (12–18 gegužės) — Email infra + Mobile dogfood

| Kas | Effort | Kas daro |
|---|---|---|
| Resend account + DNS + Supabase Auth integration | 4 val. | Dev |
| Welcome email + password reset + invite email — visi rebrand'inti | 2 val. | Dev |
| Mobile dogfood (Andreja 7 dienų telefone savo žirgyne) | 7 d. parallel | Andreja |
| Public landing (Hoofbeat-Waitlist-Landing.html → Longrein-Waitlist-Landing.html, deploy'inti į longrein.eu) | 2 val. | Dev |

**Sav. 2 exit criterion:** longrein.eu live'e. Welcome email'ai siunčiami iš @longrein.eu. Andreja dogfood'inti pirmą savaitę, identifikuoti top 5 friction'us.

#### Sav. 3 (19–22 gegužės) — Mobile fix + dry run

| Kas | Effort | Kas daro |
|---|---|---|
| Top 5 mobile friction'ų pataisymai | 2 d. | Dev |
| Personalizuoti 10 outreach email'us | 4 val. | Andreja |
| Founding Members oferto + onboarding skript'as su brand'u | 2 val. | Aš (Claude) |
| Cal.com setup demo'ams (longrein.eu/demo) | 1 val. | Andreja |
| Dry run: Andreja onboard'ina FIKTYVŲ žirgyną nuo nulio (signup → 5 horses → 1 client → 1 lesson → 1 invoice) | 30 min | Andreja |

**Sav. 3 exit criterion:** Andreja gali onboard'inti naują žirgyną per 30 min. be jokių 500 errors. Top 5 mobile frictions ištaisytos. 10 personalizuotų email'ų paruošti siųsti.

### LAUNCH DATA: Šeštadienis, 2026-05-23 (3 sav. nuo šiandien)

Tu tą dieną siunti 10 personalizuotų email'ų. Pirmoji savaitė po launch'o — demo'ai + setup'ai. Mėnuo 1 — savaitiniai check-in'ai. Mėnuo 2–3 — feedback'as veda produkto roadmap'ą + Stripe checkout build'as antrai bangai (mokami klientai mėn. 6).

---

## Dalis 5 — Ką paliekam, ką pakeičiam

### PALIKAM

- ✅ Welfare-first dashboard + 5-bucket counter strip — TAVO wedge'as
- ✅ Sessions vs. Lessons atskyrimas — teisingas
- ✅ Per-horse profitability view — owner stickiness gem'as
- ✅ Onboarding checklist + welcome tour — pirmas friction killer'is
- ✅ Smart suggestions widget — pro-aktyvi vertė
- ✅ Cmd+K command palette — premium signalas
- ✅ Birthdays widget — emocinis sluoksnis
- ✅ Public stable page `/s/[slug]` — IF padarom self-booking flow vėliau
- ✅ Audit log — compliance signalas
- ✅ Cards + Cream + Paddock palette — atrodo premium
- ✅ Database GIST exclusion constraints — production-grade kokybė

### PAKEIČIAM (kritiniai)

- ❌ Hoofbeat → Longrein VISUR
- ❌ Pridėti GDPR puslapius
- ❌ Pridėti Resend email'ams
- ❌ Pridėti landing page deployment'ą

### KILL'INAM (audit'o rekomendacija stovi)

- ❌ Internal Chat module — feature-flag OFF default'iškai. Marketing'inti niekada. Konkuruoti su WhatsApp = tarpit'as. Tavo founding members JAU naudoja WhatsApp grupes.
- ❌ Activity heatmap dashboard'e (jei dubliuoja welfare bucket strip — pasirink vieną)
- ❌ Hardcoded fake bars Revenue card'e (`{[30, 50, 40, 65, 55, 75, 90].map ...}`) — fake data dekoracija = vienas didžiausių „cheap" tell'ų B2B SaaS'e

### ATIDEDAM (mėn. 4+)

- Stripe checkout flow (po pirmų 5 patenkintų founding members)
- Mollie alternatyva (jei SEPA reikalinga didelėms livery yards)
- SMS reminders
- LT i18n (kol founding members angliškai)
- Client self-booking flow
- WhatsApp deep-link
- PWA + offline
- Accountant CSV export

---

## Dalis 6 — Mano kaip auditor'iaus tiesioginė nuomonė

Tau klausimas buvo: ar appsa pasiruošusi 10 founding members?

Atsakymas: **dabar — ne, per 3 sav. — taip.** Bet ne dėl to, kad appsa silpna — atvirkščiai, ji STIPRESNĖ nei dauguma vertical SaaS'ų pre-revenue. Ji ne paruošta dėl operacinių dalykų, kuriuos lengva pataisyti per 3 sav.:

1. Brand rename (cosmetic, daug rankinio darbo)
2. GDPR puslapiai (legalu privaloma)
3. Email infra (trust)
4. Mobile dogfood (rizikos eliminavimas)
5. Domain + landing deployment (commercial setup)

Niekas iš šių neapima naujų feature'ių. Tai operacinis launch'o setup'as, kurį perkėliau iš „turiu padaryt vėliau" į „turiu padaryt prieš rašant pirmam žirgynui".

**Ko neturėtum daryti per šias 3 sav.:**

- Build'inti naujus feature'ius (recurring lessons, vet/farrier events, client self-booking) — viskas po founding members feedback'o, ne prieš
- Rūpintis Stripe checkout'u — founding members ant nemokamo plano
- LT lokalizacija — founding members angliškai, jei reikia, tu pati padedi LT klientams onboard'ui
- Kelti naują logo (The Arch wordmark) — wordmark v1 = serif „Longrein." (Source Serif 4) yra 90% premium. Galutinis logo po PMF.

**Founder discipline'as — pirmi 30 dienų po launch'o yra GROW PRODUCT'O 0% laikas. 100% tavo laiko = onboarding, klausimai, feedback'o klausymas. Ne nauji feature'iai. Tai diciplina, kuri skiria 10/10 founding members ambasadorių nuo 3/10 dropouts.**

---

## Closing

Tu turi premium-quality SaaS produktą su unikaliu wedge'u (welfare-first), tikra founder credibility (savo žirgynas), ir užfiksuotą brand'ą (Longrein, ką tik pasirinktas). Per 3 sav. paruošime tau kelią išsiųsti 10 personalizuotų email'ų ir pradėti tikrą founding members raundą.

Kitas žingsnis: pirk longrein.eu per Hostinger DABAR (€8). Tai nepriklausomas nuo audit'o sprendimas — tai visada teisinga padaryti. Atsiusk Hostinger krepšelio screenshot'ą prieš mokėjimą, kad patvirtintume.

Po pirkimo — dirbsim Sav. 1 sprint'e (brand rename + GDPR + 10 žirgynų shortlist).

— audit'o galas
