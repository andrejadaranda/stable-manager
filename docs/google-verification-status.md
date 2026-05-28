# Google verification — kur esame ir ką darom

**Atnaujinta:** 2026-05-27 (po SEO sprinto)

Trumpai: ši lentelė rodo kiekvieną Google platformą, kur turime būti matomi, dabartinį statusą, ir konkretų veiksmą kurį turi atlikti tu — be jokio papildomo techninio darbo iš mano pusės.

---

## Greitas overview

| Platforma | Statusas | Ką darai | Laikas |
|---|---|---|---|
| **Google Search Console (GSC)** | ⚠️ DNS pridėta, **bet patvirtinimas dar nepaspaustas** | Eik į GSC, paspausk "Verify" | 5 min |
| **Bing Webmaster Tools** | ❌ Visai neregistruota | Sukurk paskyrą, pridėk longrein.eu | 10 min |
| **Google Business Profile (GBP)** | ❌ Nesukurta | Sukurk profilį → laukti pašto atviruko ~10–14 dienų | 15 min + paštas |
| **Sitemap submit** | ❌ Sitemap egzistuoja, bet niekur nepateikta | Po GSC verify — pateikti sitemap.xml | 2 min |

---

## 1. Google Search Console (svarbiausia)

**Kas tai:** Google įrankis kuris parodo, kur tavo svetainė atsiranda paieškoj, kokie raktiniai žodžiai ją randa, klaidos, kurios trukdo indexuoti. Be jo — esi aklas Google atžvilgiu.

**Statusas:**
- DNS TXT įrašas pridėtas Hostinger DNS lentelėj (atlikta gegužės 25 d.).
- DNS propagacija per visą pasaulį užtrunka 24–48 val. — turėtų jau būti baigta.
- **Patvirtinimas dar nepaspaustas tavo Google account'e.** Be šito žingsnio — GSC nieko nemato.

**Veiksmas:**
1. Atidaryk https://search.google.com/search-console
2. Prisijunk su darandaandreja@icloud.com (arba kuriuo Google account'u tau patogiau)
3. Pamatysi sąraše `longrein.eu` su "Verify" mygtuku — paspausk
4. Jei rodo "Verification failed" → DNS dar nepropaguotas → palauk valandą, bandyk iš naujo
5. Kai patvirtinta → meniu „Sitemaps" → įvesk `sitemap.xml` → Submit

**Ko nedaryti:** Neperverify'k per HTML failą jei TXT jau veikia — sumaišysi.

---

## 2. Bing Webmaster Tools

**Kas tai:** Tas pats kas GSC, bet Bing/Yahoo/DuckDuckGo paieškai. Bing yra ~3% pasaulinės paieškos rinkos, bet ChatGPT search ir Microsoft Copilot naudoja Bing indeksą — be jo netampi matomas AI paieškose.

**Statusas:** ❌ Nieko nesukurta.

**Veiksmas (10 min):**
1. Atidaryk https://www.bing.com/webmasters
2. Prisijunk su Microsoft account'u (Outlook arba sukurk naują)
3. Add a site → įvesk `https://longrein.eu`
4. Pasirink "Import from Google Search Console" jei GSC jau patvirtintas (greičiausias kelias) — vienu paspaudimu užkels viską
5. Jei GSC dar nepatvirtintas — verify per DNS TXT (Bing duos savo TXT, įdėk į Hostinger lygiai taip pat kaip Google)
6. Po verify → Sitemaps → `https://longrein.eu/sitemap.xml`

---

## 3. Google Business Profile (GBP) — laukiamas atvirukas

**Kas tai:** Tai matomumas Google Maps + Google "Knowledge panel" (dėžutė dešinėje paieškos rezultatuose su tavo logo, valandomis, nuotraukomis). Vietinis SEO — kai kas nors ieško "žirgynas Vilnius" arba "riding school Lithuania".

**Statusas:** ❌ Profilis dar nesukurtas. **Tu teisingai atspėjai:** Google reikalauja **fizinio pašto atviruko** patvirtinti verslo adresą prieš leisdami profilį padaryti viešą. Atvirukas ateina per 10–14 dienų.

**Veiksmas:**
1. Atidaryk https://business.google.com
2. Add business → įvesk:
   - **Business name:** Longrein
   - **Category:** Software company arba Equestrian facility (galima dvi — pasirink Software pirmiausia)
   - **Country/Region:** Lithuania
   - **Address:** TAVO fizinis adresas Vilniuje (kur Google atsiųs atviruką — gali būti namų)
   - **Phone:** tavo verslo telefonas (nebūtina parodyti viešai)
   - **Website:** https://longrein.eu
3. Google pasiūlys "Mail" patvirtinimo metodą — pasirink
4. Atvirukas ateis per ~10–14 dienų su 5-skaitmeniu kodu
5. Kai gauni — įvesk kodą GBP dashboard'e → profilis tampa viešas
6. Po patvirtinimo: įkelk 5–10 nuotraukų (Longrein logo, app screenshot'ai), nustatyk darbo valandas, parašyk verslo aprašymą

**Ko nedaryti:** Niekada nemeluok adreso. Jei atvirukas grįžta, Google užblokuoja paskyrą savaitėms.

---

## 4. Sitemap pateikimas (po GSC verify)

**Kas tai:** Pasakai Google'ui, kur yra tavo URL'ų sąrašas, kad jis greičiau indeksuotų visus naujus puslapius.

**Statusas:** Sitemap.xml egzistuoja (`https://longrein.eu/sitemap.xml`, naujausias commit įdėjo 9 naujus URL'us — vs-equilab, for-riding-schools, ir t.t.), bet niekam apie tai nepasakyta.

**Veiksmas:** Atlieksi automatiškai sekant 1 punkto pabaiga (GSC → Sitemaps → submit).

---

## Kas vyks po šių žingsnių

**1–7 dienos po GSC verify + sitemap submit:**
- Google pradės crawlinti naujus puslapius
- GSC pradės rodyti impressions (kiek kartų pasirodėm paieškoj) — gali būti 0 pirmą savaitę

**2–6 savaitės:**
- Long-tail puslapiai (vs-equilab, for-riding-schools, lithuania, ir t.t.) pradės ranking'inti #5–#20 pozicijoje žemų konkurencijos paieškose
- Brand query "longrein" pradės rodyti tavo namų puslapį #1 (jokio konkurento su tuo vardu nėra)

**6–12 savaitės:**
- Top 3 long-tail puslapiai gali pasiekti #1–#3 jei nieko netrukdo
- "equestrian software lithuania" – realiai pasiekiamas #1 per 8–10 sav.
- "stable management software europe" – konkurencingesnis, taikom #5–#10 per 12 sav.

**GBP atvirukas atvyks per 10–14 dienų** ir tik tada Google Maps bei Knowledge Panel pradeda rodyti Longrein.

---

## Greita check'list (atlikti DABAR, viskas <30 min)

- [ ] GSC: Verify mygtukas paspausstas → Sitemap submitintas
- [ ] Bing Webmaster: paskyra sukurta → site pridėtas → Sitemap submitintas
- [ ] GBP: profilis sukurtas → adresas įvestas → "Mail verification" pasirinkta → laukiame atviruko

Po to — laukimas. SEO nėra greitas, bet ši bazė kritinė.
