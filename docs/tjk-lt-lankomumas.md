# tjk.lt lankomumo skaitiklis — ką įklijuoti

Šitą lapą gali persiųsti tam, kas tvarko tjk.lt. Daugiau nieko nereikia:
jokių paskyrų, jokių raktų, jokių slapukų.

---

## Kas tai

Viena eilutė, kuri suskaičiuoja, kiek žmonių apsilanko tjk.lt. Skaičiai
keliauja tiesiai į Longrein duomenų bazę ir matomi Andrėjos lentoje.

**Ko NEsurenkama:** IP adresų, naršyklės duomenų, slapukų, jokių
asmens duomenų. Įrašomas tik dienos skaitiklis kiekvienam puslapiui
(pvz. „2026-08-07 · /apie-mus · 14 peržiūrų"). Todėl slapukų juostos
ar sutikimo nereikia.

Gerbiamas ir „Do Not Track" nustatymas.

---

## Ką įklijuoti

Į `</body>` žymę, prieš pat ją — arba per WordPress temą
(Appearance → Theme File Editor → footer.php), arba per bet kurį
„insert headers and footers" tipo įskiepį.

```html
<script>
(function () {
  try {
    if (navigator.doNotTrack === "1") return;
    var v = false;
    try {
      if (!sessionStorage.getItem("lr_seen")) {
        sessionStorage.setItem("lr_seen", "1");
        v = true;
      }
    } catch (e) {}
    var d = JSON.stringify({
      host: location.hostname,
      path: location.pathname,
      visit: v
    });
    var u = "https://app.longrein.eu/api/pageview";
    if (navigator.sendBeacon) {
      navigator.sendBeacon(u, new Blob([d], { type: "application/json" }));
    } else {
      fetch(u, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: d,
        keepalive: true
      });
    }
  } catch (e) {}
})();
</script>
```

---

## Kaip patikrinti, ar veikia

Įklijavus atidaryk tjk.lt, palauk minutę, ir Longrein lentoje
(Rinkodara → Lankomumas) turi atsirasti eilutė `tjk.lt`.

Jei neatsiranda — naršyklėje spausk F12 → Network → filtruok „pageview".
Turi matytis užklausa su atsakymu **204**.

---

## Techninės pastabos

- Užklausa asinchroninė ir „fire-and-forget" — puslapio greičio
  neveikia ir negali jo sulaužyti. Jei Longrein neveiktų, tjk.lt
  veiktų lygiai taip pat.
- `sendBeacon` išsiunčia duomenis net jei lankytojas iškart uždaro
  puslapį.
- Serveris priima tik iš anksto žinomus adresus (`tjk.lt`,
  `longrein.eu`, `app.longrein.eu`), tad svetimų duomenų ten
  nepateks.
- Adresai su ID (pvz. `/naujiena/12345`) sugrupuojami į `/naujiena/:id`,
  kad nesusidarytų atskiro lankytojo pėdsakas.
