# Next Steps — Šiandien (2026-04-28)

> Ką tau reikia padaryti rankomis, kad viskas, ką ką tik įsidirbom, pradėtų veikti.

---

## 1. npm install stripe (1 min)

`lib/stripe/server.ts` jau parašytas, bet `stripe` package'as nepadiegtas. Be šito kiekvienas `npm run build` lūš.

```bash
cd "/Users/andrejadaranda/Documents/Claude/Projects/APP"
npm install stripe
```

Po to restartuok dev serverį (Cmd+C jei dar bėga, paskui `npm run dev`).

---

## 2. Restart dev server (10 sek)

Dėl chat + horse profile + sessions migracijų, kurias šiandien pritaikėm DB'e, Next.js cache'as nebežino apie naujas lenteles. Restartas tai išspręs.

```bash
# terminal'e kur bėga npm run dev:
# Ctrl+C
rm -rf .next   # išvalome stale build cache
npm run dev
```

Tada atidaryk `http://localhost:3000/dashboard/horses` → klikni arklį → naujas profilis su Overview/Sessions/Health/Goals/Media tabs turi rodytis be 500 errors.

---

## 3. Stripe products sukonfigūruoti (15 min, jei nori billing dabar)

Jei nori paimti pirmus pinigus, šito reikia. Jei dar nenori — praleisk ir grįžk vėliau.

**Stripe Dashboard:**

1. Sign in / sign up: https://dashboard.stripe.com/test/products
2. Sukurk 3 produktus:
   - **Stable OS — Starter** · €19/mo · €16/mo annual eff. (€192/yr)
   - **Stable OS — Pro** · €49/mo · €42/mo annual eff. (€504/yr)
   - **Stable OS — Premium** · €99/mo · €84/mo annual eff. (€1008/yr)
3. Po sukūrimo nukopijuok kiekvieno produkto `price_xxx` ID į buferį.
4. Atidaryk `.env.local` ir pridėk:

   ```
   STRIPE_SECRET_KEY=sk_test_xxx          # iš Stripe Dashboard → Developers → API keys
   STRIPE_PRICE_STARTER=price_xxx
   STRIPE_PRICE_PRO=price_xxx
   STRIPE_PRICE_PREMIUM=price_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx        # iš Webhooks tab po endpoint'o setup
   ```

5. Restartuok `npm run dev` (env vars perskaito tik startup metu).

**Webhook setup** — kai bus Stripe handler'is parašytas (Phase 2 kodo, kurio dar nėra), turėsi sukonfigūruoti webhook endpoint Stripe'e:
   - URL: `https://<tavo-vercel-url>/api/stripe/webhook`
   - Events: `customer.subscription.created`, `.updated`, `.deleted`, `invoice.paid`, `invoice.payment_failed`

---

## 4. Patikrink Phase 1 + Phase 2 darbą (5 min)

Tu prisijungęs kaip owner (`test@test.com`).

### Sessions tab — Phase 2a (Add session sheet)

1. Eik į `/dashboard/horses` → klikni „Thunder" (ar bet kurį arklį)
2. Tabs juostoje paspausk **Sessions**
3. Apatiniame dešiniajame kampe matosi **+ Add session** mygtukas
4. Klikni → atsidaro bottom sheet su 4 laukais (When / Rider / Type / Duration)
5. Pasirink rider, type='Flat', duration=60, save
6. Sąrašas pasipildo nauja eilute viršuje
7. Pereik į Overview tab — pamatysi, kad activity ring dabar rodo +1, heatmap pamatysi vieną langelį šiandienos dienoje

### Sessions tab — Phase 2b (inline note edit)

1. Naujoje session eilutėje matosi **+ add note** mygtukas po kortele
2. Klikni → atsidaro maža textarea
3. Įrašyk testo užrašą, paspausk **Save** (arba Cmd+Enter)
4. Atsiranda saved note tekstas
5. Klikni ant teksto — vėl atsidaro textarea pataisymui

### Health tab — Phase 2c

1. Pereik į **Health** tab
2. Matosi 3 status kortelės (Vaccinations / Farrier / Vet) — visos „No record yet" kol nieko nepridėjai
3. Timeline dešinėje apačioje — paspausk **+ Add record**
4. Pasirink Type=Vaccination, įrašyk Title='Tetanus booster', When=today, Next due=2027-04-28
5. Save → status kortelė pasikeičia į „Up to date" su data
6. Timeline'e atsiranda eilutė su green badge

Jeigu kažkas neveikia / atrodo blogai → siųsk screenshot'ą.

---

## 5. Nieko netęsk, kol nepatikrai #1 + #2

Šie du punktai būtini. Be jų — nieks neveiks. Likę (#3, #4) — nice to have. Pradėk nuo Terminal'io.

---

## 6. Po patikrinimų — kas toliau (rekomendacija)

Iš [PRODUCT_BACKLOG.md](./PRODUCT_BACKLOG.md) Top 10 sąrašo, mano siūlomas eiliškumas:

1. Pasirink vardą iš BRAND_NAMES.md ir užregistruok domeną (2-3 val)
2. Stripe end-to-end (1.5 d) — kai turi Stripe keys ir vardą
3. Onboarding wizard (1 d) — pirmas customer'is suaktyvėja per 60s
4. LT lokalizacija (2 d) — beachhead market kalba
5. GDPR pakuotė (4 val) — privaloma EU
6. Recurring lessons (1 d) — kiekvienas customer'is paklaus
7. Weekly digest email (2 d) — churn killer

Šito tvarka yra: **paimk pinigus → suaktyvink users → pristabdyk churn**.

---

*Šis failas vienkartinis — kai padarysi visus žingsnius, gali jį ištrinti.*
