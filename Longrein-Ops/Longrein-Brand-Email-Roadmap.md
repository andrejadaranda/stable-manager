# Longrein — Brand Email Roadmap

**Klausimas, į kurį atsako šis dokumentas:** Kada ir kaip pereiti nuo „nemokamas Gmail visam kam" link „profesionalūs branduoti email'ai", neužstabdant biznio ir nemokant per anksti.

**Trumpas atsakymas:** 4 fazės per 12 mėn. Kiekviena fazė papildo, ne pakeičia. Niekada neištrini ankstesnio sluoksnio — tik pridedi naują.

---

## Fazė 0 — Dabar (gegužė 2026)

**Kas yra:** longrein.team@gmail.com — vienintelis email'inis identitetas. Joks branduotas email dar neegzistuoja.

**Naudojimas:**
- Outbound (visi tavo siunčiami email'ai): per longrein.team@gmail.com (matosi kaip „Longrein Team <longrein.team@gmail.com>")
- Inbound (gauti email'ai): visi į longrein.team inbox
- Vendor signups: visi naudoja longrein.team
- Social media DM'ai: visi naudoja longrein.team

**Trūkumai (priimam dabar, sutvarkysim Fazėje 2):**
- @gmail.com domain'as signalizuoja „personal" pirmam founding member'iui
- Atrodo kaip startup, NE kaip įmonė
- Tavo asmens vardas dar nematomas — pasirašai „Andreja from Longrein", bet email rodo „Longrein Team"

**Kodėl OK kol kas:** founding members onboarding'as bus per Zoom, ne per email. Tu pati skambinsi, ne email'isi. Pirmieji 5 ant nemokamo plan'o nemoka už domain'ą.

**Truko:** ~30 dienų, kol bus longrein.eu pasiekiamas + reikės siųsti pirmus oficialius pakvietimus.

---

## Fazė 1 — Resend transactional setup (Sav. 2 sprint, gegužės 12-18)

**Tikslas:** Visos sistemos generuojamos email'ai (welcome, password reset, invite, lesson reminders) eina iš @longrein.eu, ne iš @gmail.com ar default Supabase noreply.

### Kas pasikeičia

**Naujas email'inis identitetas:**
- `noreply@longrein.eu` — iš to siunčiami visi automatiniai email'ai (Resend API)
  - „Welcome to Longrein"
  - „Password reset"
  - „Magic link to log in"
  - „You're invited to [Stable Name]"
  - „Reminder: Your lesson tomorrow at 17:00"
- `hello@longrein.eu` (forwards) — pirmas „branduotas" inbound email'as
  - Šiuo metu: forwarding į longrein.team@gmail.com (per Hostinger DNS — free)
  - Kontaktų formoms hoofbeat.eu landing'e, signaturėms, vizitinėms
  - Skaitysi vis dar per longrein.team Gmail inbox

### Setup veiksmai (techninė pusė)

1. Sukurti Resend account su longrein.team@gmail.com
2. Resend dashboard → Add domain → longrein.eu
3. Resend duos 4 DNS records (SPF, DKIM, DMARC, return-path) — pridėti į Hostinger DNS panel'ą
4. Verify domain Resend'e (palauk 24 val DNS propagation'ui)
5. Hostinger DNS → Email forwarding → hello@longrein.eu → longrein.team@gmail.com
6. Supabase → Auth → SMTP settings → įjungti custom SMTP → įvesti Resend SMTP credentials
7. Customize 5 Supabase Auth email templates (welcome, recovery, magic link, email change, invite) su brand voice + Paddock/Cream palette

### Outbound iš tavo asmens

Iki Fazės 2 — TU asmeniškai vis dar siunti per longrein.team@gmail.com. Tai NE problema — tas email'as ant TAVO domain'o (longrein.eu) bus tik Fazėje 2.

### Kainavimas

- Resend: free tier'as iki 3,000 email'ų/mėn (perdaug 10 founding members visam pirmiems mėn.)
- Hostinger DNS forwarding: free
- Iš viso: €0/mėn

---

## Fazė 2 — Google Workspace setup (po pirmų 5 mokančių klientų, ~mėn. 4-6)

**Tikslas:** Tavo asmeninis founder identitetas tampa branduotas. „Andreja Daranda <andreja@longrein.eu>" — kai pasirašai sutartis, kalbi su žurnalistais, atsakai partneriams.

### Kas pasikeičia

**Nauji email'iniai identitetai (visi @longrein.eu):**

| Email | Naudojimas | Inbox |
|---|---|---|
| `andreja@longrein.eu` | Tavo asmeninis founder email'as. Pirmoji klasė. | Tavo asmeninis Workspace inbox |
| `hello@longrein.eu` | Generic kontakto email'as (kontaktų formos, vizitinės) | Forwards į andreja@ |
| `support@longrein.eu` | Customer support inbox | Forwards į andreja@ pradžioje, vėliau atskiras inbox |
| `billing@longrein.eu` | Sąskaitybos klausimai | Forwards į andreja@ |
| `legal@longrein.eu` | Teisiniai klausimai (vendor sutartys, GDPR DPR) | Forwards į andreja@ |
| `noreply@longrein.eu` | Lieka per Resend (Fazė 1) | Niekas neskaitys, tik siuntimas |

### Migracija (kruopščiai)

**Inbound migracija** — 1 sav.
1. longrein.team Gmail → Settings → Forwarding → forward'inkk visus naujus į andreja@longrein.eu
2. Atnaujink visų vendor'ių „Account email" į andreja@longrein.eu (KAS ATSARGIAI — kai kurie vendor'iai gali sukelti reauthentication)
3. Atnaujink social media account'ų recovery email į andreja@longrein.eu
4. Atnaujink Bitwarden įrašus su nauja email'ų informacija
5. Atnaujink šitą dokumentą + Vendor Tracker xlsx

**Outbound migracija** — instant
1. Tavo Mac email client'as (Apple Mail arba Gmail web) — pridėk Workspace inbox
2. Tu siunčiu tik iš andreja@longrein.eu — niekada daugiau iš longrein.team@gmail.com (jei tai oficialus founder voice)
3. longrein.team@gmail.com lieka VEIKIANTI tiesiog kaip ops/Drive root account — niekam nesiusi naujų email'ų iš jos, tik gauni vendor automated notifikacijas

### Kainavimas

- Google Workspace Business Starter: €6/mo (pirmas useris)
- Pridedami aliases (hello@, support@, billing@, legal@): nemokami (incl. plane)
- Iš viso: €6/mėn (€72/metams)

### Kada paleisti?

Trigger'iai (bet kuris iš 3):
- 5+ mokantys klientai (revenue dengia Workspace cost'ą 12x)
- Pirmoji partnership negotiacija (žurnalistai, federation reps) — branduotas email'as = trust signal
- Pirma vendor sutartis €1,000+ vertės (legal + branduotas email atrodo profesionalaus)

---

## Fazė 3 — Team aliases ir shared inboxes (kai team'as auga, mėn. 12+)

**Tikslas:** Kai pridedami pirmas asmuo (virtualus asistentas, copywriter, customer success specialist), branduotų email'ų sistema jau yra paruošta priimti.

### Kas pasikeičia

**Team member email'ai:**
- `vardas@longrein.eu` — kiekvienas team narys gauna savo asmeninį Workspace seat'ą
- `team@longrein.eu` — group email'as visiems narams (announcements, discussions)

**Shared inboxes:**
- `support@longrein.eu` virsta tikru shared inbox'u (Google Group + Workspace)
- `hello@longrein.eu` virsta shared inbox'u
- Tu nustojate būti single point of failure

### Kainavimas

- €6/user/mo (Workspace Business Starter)
- Pirmas user (tu): €6
- Antras user (VA arba CS): +€6
- ...

**Auga pagal team. NESinvestuok per anksti.**

---

## Fazė 4 — Marketing email infrastruktūra (kai content engine veikia, mėn. 6-12)

**Tikslas:** Newsletter + nurture sequences eina iš dedikuoto marketing email'o, atskirai nuo transactional.

### Kas pasikeičia

**Naujas email'inis identitetas:**
- `news@longrein.eu` — newsletter subject line'as „From: Andreja at Longrein <news@longrein.eu>"

### Setup

1. Loops.so account (jau Vendor Tracker'yje)
2. Connect Loops prie longrein.eu DNS (papildomi DKIM įrašai)
3. Sukurk pirmąją sequence (3-email Founding Members nurture)

### Kainavimas

- Loops free: 1,000 contacts (užtenka pirmiems 6 mėn.)
- Loops paid: nuo $49/mo už 3,000+ contacts
- Iš viso pradžioje: €0

---

## Lentelė — kuris email'as kada egzistuoja

| Email | Fazė 0 (gegužė) | Fazė 1 (Sav. 2) | Fazė 2 (Mėn. 4-6) | Fazė 3 (Mėn. 12+) |
|---|---|---|---|---|
| longrein.team@gmail.com | ✅ Visi outbound | ✅ Asmeninis outbound | ⚙️ Tik ops/Drive root | ⚙️ Ops only |
| noreply@longrein.eu | — | ✅ Resend transactional | ✅ Lieka | ✅ Lieka |
| hello@longrein.eu | — | ✅ Forwards į gmail | ✅ Forwards į andreja@ | ✅ Shared inbox |
| andreja@longrein.eu | — | — | ✅ Founder outbound | ✅ Lieka |
| support@longrein.eu | — | — | ✅ Forwards | ✅ Shared inbox |
| billing@longrein.eu | — | — | ✅ Forwards | ✅ Forwards |
| legal@longrein.eu | — | — | ✅ Forwards | ✅ Forwards |
| team@longrein.eu | — | — | — | ✅ Group email |
| news@longrein.eu | — | — | — | ✅ Marketing |

---

## Saugumo svarbi pastaba

Kiekviename pereinant tarp fazių — atnaujink šituos:

1. **Vendor Tracker xlsx** — kiekvieno vendor'iaus „Account email" laukas
2. **Bitwarden vault** — atitinkami URL/notes laukai
3. **Recovery email'us** kiekvienam vendor'iui (jei pridedi naujų email'ų pakeisti į branduotus)
4. **Social media account'ai** — recovery email'ai
5. **Šis dokumentas** — pažymėk faktinę migracijos datą (kada įvyko)

**Niekada neištrink ankstesnio email'o sluoksnio.** longrein.team@gmail.com lieka aktyvus per visas fazes — tai operacinis Drive + social media root. Jei ištrinsi, prarasi prieigą prie 30+ vendor'ių.

---

## Decisions log

Įrašyk kiekvieną svarbų sprendimą su data:

| Data | Sprendimas | Priežastis |
|---|---|---|
| 2026-05-02 | longrein.team@gmail.com sukurtas kaip company core | Pradinis setup'as. Neturim domain'o, neturim revenue, Workspace per anksti. |
| | | |

---

*Atnaujinti šį dokumentą po kiekvieno fazės perėjimo. Įkelti į Drive `06_Ops/`.*
