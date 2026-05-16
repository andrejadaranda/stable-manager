# Longrein Sprint Day 1 — Execution Pack
**Šiandien:** Ketvirtadienis, 2026-05-07
**Tikslas:** 3 dalykai, kurie turi būti padaryti šiandien iki 18:00

---

## ✅ ACTION 1 — Pranešti dev chat'ui apie landing page (5 min)

**Atidaryk paraleliam Claude chat'ą (kuriame dirba dev darbai).**
**Copy-paste šitą message'ą exactly:**

---

```
🚨 P0 SPRINT — landing page deadline 2026-05-10

Andreja čia. Šiandien pradedu 16-dienų pre-launch sprint'ą social media + outreach (žr. /APP/Longrein-Ops/Longrein-Pre-Launch-16Day-Sprint-2026-05-07.md).

Visi IG postai ir LinkedIn postai turės "link in bio" → longrein.eu. Šiuo metu domain rodo Hostinger parked page.

Reikia: longrein.eu LIVE iki sekmadienio 2026-05-10 18:00 EET.

V1 MINIMUM (būtina):
1. Hero section: Longrein logo (yra /APP/brand/logo/png/wordmark-1520x360.png) + tagline "Stable management built in Europe"
2. 1 paragrafas pozicija — naudoti copy iš /APP/Longrein-Ops/Longrein-Public-Launch-Press-Kit-2026-05-02.md (sekcija "About Longrein")
3. WAITLIST EMAIL SIGNUP forma — Resend integration arba Tally/Formspree embed (tinka bet kuris)
4. "Founding Members" sekcija — 3 sakiniai apie 12 mėn nemokamai, CTA email "andreja@longrein.eu" arba waitlist signup
5. Footer: Privacy Policy placeholder, Terms placeholder, kontaktas
6. Mobile responsive (50%+ traffic'o ateis iš telefono)

V1 NEKRITINIS (gali ateiti M1):
- Pricing puslapis
- Blog
- /help
- Login/signup į actual app

Tech sprendimai (tau pasirinkti):
- Option A: Next.js + Vercel + Resend (esama stack'as) — preferred jei spėji
- Option B: paprasta Carrd.co arba Tally page jei Next.js per ilgai

Priority order:
1. Domain DNS pointing į Vercel/host (būtina visam kitkam)
2. Email signup form (capture pre-launch waitlist)
3. Hero + copy (gražumas)
4. Mobile responsive (testuoti telefone prieš deploy)

Daily standup šiame chat'e:
Kasdien 08:00 statusas: ✅ done / 🟡 in progress / 🔴 blocked.

Jei iki sekmadienio 2026-05-10 18:00 ne live — aktyvuosiu Carrd.co fallback pati ir tu likdamasis dirbsi tik ant V2 proper Next.js.

Klausimai? Paimi iš ten. Žinok, kad šitas yra blocker'is launch'ui — be šito visi 14 IG postų eis į parked domain page'ą.
```

---

**Po išsiuntimo:** Lauk dev chat'o atsakymo. Greičiausiai paklaus 1-2 klausimų (Vercel access? Resend API key? Domain DNS access?). Atsakyk ir grįžk čia.

---

## ✅ ACTION 2 — Sukelti 14 IG postų į Buffer (30 min)

### Kodėl Buffer (ne Later/Hootsuite):
- **Free plan'as:** 10 scheduled posts, 3 channels (užtenka šiam sprint'ui)
- **Mobile app**: gali edit'inti iš telefono
- **IG Reels support**: free plan'e veikia (Later free reels'ams reikia paid'o)

### Setup steps (iš pradžių):

**Žingsnis 1 — Sukurti Buffer account:**
1. Eik į [buffer.com/signup](https://buffer.com/signup)
2. Sign up su `longrein.team@gmail.com`
3. Patvirtink email'ą
4. Pasirink "Free plan"

**Žingsnis 2 — Connect channels:**
1. Buffer dashboard → "Connect a channel"
2. Pasirink **Instagram** → Continue
3. Login į IG Business profile (@longreinapp)
4. Authorize Buffer
5. Pakartok su **LinkedIn** (Personal profile + Company Page = 2 channels — šito gali nereikėti šitam sprint'ui, gali handle'inti LinkedIn manual'iai)

⚠️ **IG Business profile reikalingas** — jei vis dar Personal'us, pakeisk šiandien (tai mobile-only veiksmas: IG → Settings → Account → Switch to Professional).

**Žingsnis 3 — Schedule rules:**
Buffer dashboard → Channel settings → Posting Schedule:
- Pirmadieniai: 09:00
- Antradieniai: 19:00
- Trečiadieniai: 18:00
- Ketvirtadieniai: 19:00
- Penktadieniai: 12:00
- Šeštadieniai: 12:00
- Sekmadieniai: 18:00

(Buffer auto-fillins posts į next available slot pagal queue.)

### Žingsnis 4 — Sukelti 14 postų

**Vietoj kopijuoti čia visus 14 captions (per ilgas dokumentas), naudoti šitą metodą:**

1. Atidaryk dokumentą: `/APP/Longrein-Ops/Longrein-IG-First-30-Days-2026-05-02.md`
2. Atidaryk Buffer dashboard'e "Queue" → "Add to queue"
3. Per kiekvieną postą (#1 → #14) atlikti:
   - Copy caption iš docs
   - Paste į Buffer "What's on your mind?"
   - Pridėti visualą (žr. lentelę žemiau)
   - "Schedule" → pasirinkti datą (žr. lentelę žemiau)
   - "Add to queue"

### Postų schedule + visualų file paths

| Post | Diena | Time | Tipas | Visual file |
|---|---|---|---|---|
| #1 Brand reveal | Today May 7 | NOW (manual post) | Single img | `/APP/brand/logo/png/wordmark-square-cream-1080x1080.png` |
| #2 Founder voice | May 8 (Pn) | 19:00 | Reel 15-20s | RECORD šiandien po 14:00 |
| #3 5-tool problem | May 9 (Št) | 12:00 | Carousel 5 slides | CANVA design (žr. žemiau) |
| #4 Why this exists | May 10 (Sk) | 18:00 | Reel 30s | RECORD May 8-9 |
| #5 Workload defined | May 11 (Pr) | 09:00 | Carousel 4 slides | CANVA |
| #6 Yard 6:47am | May 12 (At) | 18:00 (story slot moved) | Single img | FOTO TJK rytą |
| #7 Phone-first demo | May 13 (Tr) | 18:00 | Reel screen rec | RECORD (Longrein app) |
| #8 European-native | May 14 (Kt) | 19:00 | Carousel 6 slides | CANVA |
| #9 Welfare strip | May 15 (Pn) | 12:00 | Single img | SCREENSHOT Longrein |
| #10 Day in life | May 16 (Št) | 12:00 | Carousel 6 slides | CANVA |
| #11 Founder VO | May 18 (Pr) | 09:00 | Reel 30s | RECORD May 17 (Sun off — gali pre-record) |
| #12 Quote card | May 19 (At) | 19:00 | Single img | CANVA |
| #13 FM story | May 20 (Tr) | 18:00 | Carousel 7 slides | CANVA |
| #14 Cinematic | May 21 (Kt) | 19:00 | Reel 20s | FILMING SESSION |

### Visualų production plan (next 16 d.)

**Šitos sav. (May 7-9):**
- ✅ Post #1 visual READY (`wordmark-square-cream-1080x1080.png`)
- 🎬 Post #2 reel: filmuoti šįryt arba rytoj 6:00-8:00 (Trakų JK)
- 🎨 Post #3 carousel: Canva 30 min — sukurti template, copy iš docs
- 🎬 Post #4 reel: filmuoti same session kaip Post #2

**Sav. 2 (May 10-16):**
- 🎬 Post #6: foto rytą May 12
- 🎬 Post #7: phone screen recording (Longrein app jau veikia po dev sprint'o)
- 🎨 Posts #5, #8, #10: Canva (1 sesija ~2h, daryti May 11 vakarą)
- 📸 Post #9: Longrein app screenshot (vyks po app dogfood)

**Sav. 3 (May 17-22):**
- 🎬 Post #11: reel record May 14 (with YouTube filming session)
- 🎨 Posts #12, #13: Canva (1 sesija ~1h)
- 🎬 Post #14: cinematic session May 14 (taip pat YouTube day)

### Canva setup šiandien (10 min)

1. Atidaryk Canva (`canva.com`, login per Google `longrein.team@gmail.com`)
2. Sukurk Brand Kit:
   - Upload `wordmark.svg` arba `.png` versijas
   - Add brand colors:
     - Paddock Green: `#2E4A2E`
     - Saddle Tan: `#B8804A`
     - Arena Cream: `#F4EFE3`
   - Add fonts: **Source Serif 4** (headings), **Inter** (body)
3. Sukurk template'us:
   - "IG Carousel Slide" 1080×1350 — Cream background, Paddock heading
   - "IG Quote Card" 1080×1080 — Cream background, large serif quote
   - "IG Story" 1080×1920 — vertical version

Šitas template'as taupys 30 min/Carousel'ui visam sprint'ui.

---

## ✅ ACTION 3 — Publikuoti Post #1 ŠIANDIEN (15 min)

### Visualas

Failas: `/APP/brand/logo/png/wordmark-square-cream-1080x1080.png`
- Square 1080×1080 (perfect IG single image)
- Cream background, Paddock Green wordmark, Saddle Tan period
- Brand-locked

### Caption (paruošta copy-paste)

```
Longrein.

Stable management built in Europe.
For riding schools, livery yards, and private stables.

We started where it makes sense to start: at a real yard, with real horses, real clients, and the same mess of WhatsApp groups, Excel sheets, and paper diaries that every stable owner knows by heart.

Run the yard. Protect the horses.

Link in bio.

#equestrian #stable #ridingschool #liveryyard #equestrianbusiness #builtineurope #stablemanagement #equineoperations #horsesofinstagram #equestrianlife
```

### Pre-flight checklist (prieš publish)

- [ ] IG Business profile aktyvuota (jei Personal — pakeisti pirma)
- [ ] Bio updated:
  ```
  Stable management built in Europe.
  Run the yard. Protect the horses.
  📍 Built in Trakai, LT
  Founding Members open → link below
  ```
- [ ] Bio link → kol landing page nelive, naudoti `linktr.ee/longreinapp` arba paprastą Notion page (sukurti per 5 min)
- [ ] Cross-post į @trakujojimoklubas STORY: "Big news from us → @longreinapp"

### Step-by-step publish (mobile only — IG nepublikuoja per desktop):

1. Atidaryk IG mobile app
2. Switch į @longreinapp account (jei dar nesi)
3. Tap "+" (post)
4. Pasirinkti `wordmark-square-cream-1080x1080.png` iš galerijos
   - Jei nukopijuotas į telefoną dar ne — siųstis email'u sau iš `/APP/brand/logo/png/`, save į Photos
5. Skip filtrus (brand'as jau nustatytas)
6. Caption: paste iš aukščiau
7. **Alt text** (Advanced settings → Accessibility):
   ```
   Longrein logo — Cream serif L with Saddle Tan dot on Paddock Green background.
   ```
8. **Tag location:** Trakai, Lithuania
9. **Share to Facebook:** ON (cross-post)
10. **Share**

### Post-publish (per 30 min po publish):

- [ ] Šaukti 3 closest contacts (telefonu/WhatsApp): "Šiandien paskelbiau pirmą postą @longreinapp — gali like'inti ir share'inti į savo story?"
- [ ] @trakujojimoklubas story repost (15 sec story su CTA "Follow @longreinapp")
- [ ] LinkedIn personal — paskelbti pre-rašytą Post #1 (žr. `Longrein-LinkedIn-First-30-Days` Post #1)
- [ ] Atsakyti į pirmus 5 komentarus per 1h (algoritmas mato reaktyvumą)

---

## ⏰ Šiandienos timeline (suggested)

| Time | Task | Hours |
|---|---|---|
| 08:00–09:00 | TJK ryto ops (regular) | 1h |
| 09:00–09:30 | ACTION 1 — dev chat escalation | 0.5h |
| 09:30–10:00 | ACTION 3 — Post #1 publish | 0.5h |
| 10:00–14:00 | TJK ops continued | 4h |
| 14:00–15:00 | ACTION 2 — Buffer setup | 1h |
| 15:00–16:00 | Canva brand kit + 1 carousel template | 1h |
| 16:00–17:00 | Filming Post #2 reel (TJK arklidės) | 1h |
| 17:00–18:00 | Post-publish engagement (atsakyti komentarams) | 1h |
| 18:00+ | DONE — supper, family, off | — |

**Total Longrein darbas šiandien: 4h. Plus TJK 5h. Plus engagement throughout.**

---

## 📋 End-of-day check (21:30, prieš sleep)

- [ ] Post #1 IG live? (kiek likes/comments po 8h?)
- [ ] LinkedIn post #1 live?
- [ ] Buffer setup'as completed (account + 1 channel connected)?
- [ ] Dev chat'as gavo landing page eskalaciją? Atsakymas iš jų?
- [ ] Post #2 reel material'as filmed?

**Jeigu 4/5 done — žalia. Jeigu 3/5 — geltona, neužstrikti. Jeigu < 3 — investigate kas blokavo, recalibrate rytoj.**

---

## 🚨 Jei kažkas eina blogai šiandien

**Scenario A: IG Business profile reikalauja Facebook Page sąsajos** (dažna situacija)
→ Sukurti FB Page (jei dar nėra) = 10 min, link'inti, retry.

**Scenario B: Buffer atmeta IG connection** (kartais auth bug'ai)
→ Skip Buffer šiandien, post'ink #1 manually. Buffer setup rytoj. Galima visus 14 postų su Buffer queue per 30 min vienkartiniam set up'ui.

**Scenario C: wordmark visualo nematei iki šiol**
→ Atidaryk `/APP/brand/Longrein-Logo-System-Overview.png` (preview visų logo variantų). Pasirinkti `wordmark-square-cream-1080x1080.png`.

**Scenario D: Per pavargusi šiandien postui**
→ Post'ink Post #1 RYTOJ (May 8) kartu su Post #2 reel. Schedule'as paslenka 1 d., bet sprint'as išlaikomas.

---

## ❓ Klausimai man (atsakysiu, kai pasakysi)

1. Ar dev chat'as veikia tame pačiame Claude session'e, ar atskira sesija? (Jei atskira — ar turi prieigą iš to chat'o iki šito — same workspace?)
2. Ar IG account jau Business profile, ar dar Personal? (Buffer'iui reikia Business)
3. Ar yra Facebook Page jau sukurtas? (IG Business prijungiamas per FB)
4. Ar turi Canva paid plan'ą, ar free? (Free užtenka šiam sprint'ui)
5. Kuriam laikui šiandien gali skirti šitą sprint'ui (4h ar mažiau)?

---

**Owner:** Andreja
**Status:** ACTION DAY 1
**Next checkpoint:** šiandien 21:30 EOD review
