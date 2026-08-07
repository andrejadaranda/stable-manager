// Settings — where she pastes the tokens the integrations need.
//
// Not in the bottom tab bar: it's a setup screen, visited a handful of
// times, and a sixth tab would push the other five below thumb comfort.
// Reached from the Today screen and from each empty state that needs it.

import { getIntegrationStatuses } from "@/services/personalDashboard/settings";
import { getPersonalContext } from "@/lib/personal/access";
import { ScreenHeader, Section, Panel, Chip } from "@/components/personal/ui";
import { ActionForm, Field } from "@/components/personal/interactive";
import { EnablePush } from "@/components/personal/enable-push";
import { saveSettingsAction } from "@/app/personal/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nustatymai" };

export default async function SettingsScreen() {
  const ctx = await getPersonalContext();
  const statuses = await getIntegrationStatuses([
    "anthropic",
    "instagram",
    "facebook",
    "website",
    "monitoring",
    "longrein",
    "briefing",
  ]);
  const status = (p: string) => statuses.find((s) => s.provider === p);

  /** Chip label that distinguishes "she pasted it" from "it's in Vercel". */
  const chip = (p: string, whenSet = "prijungta", whenUnset = "neprijungta") => {
    const s = status(p);
    if (!s?.configured) return <Chip tone="neutral">{whenUnset}</Chip>;
    return (
      <Chip tone="positive">
        {s.fromEnv ? "iš Vercel" : `${whenSet} ${s.maskedHint ?? ""}`.trim()}
      </Chip>
    );
  };

  return (
    <>
      <ScreenHeader eyebrow="Konfigūracija" title="Nustatymai" />

      {/* ---------- Notifications ---------- */}
      <Section title="Rytiniai pranešimai">
        <Panel>
          <EnablePush />
        </Panel>
      </Section>

      {/* ---------- Anthropic ---------- */}
      <Section title="Asistentė (Claude)" action={chip("anthropic", "įvesta", "neįvesta")}>
        <Panel>
          <p className="mb-3 text-[11.5px] leading-relaxed text-ink-500">
            Be šio rakto „Ką siūlau šiandien“ lieka tuščia. Raktą gauni{" "}
            <code className="rounded bg-surface-muted px-1">console.anthropic.com</code> →
            API keys → Create key. Įklijuok čia — veiks iškart, be jokio
            perkėlimo į Vercel.
          </p>
          <ActionForm action={saveSettingsAction} submitLabel="Išsaugoti raktą">
            <input type="hidden" name="provider" value="anthropic" />
            <Field
              label="API raktas"
              name="apiKey"
              type="password"
              placeholder="sk-ant-…"
              hint="Saugomas tik tavo eilutėje, apsaugotoje RLS. Atgal niekada nerodomas."
            />
          </ActionForm>
        </Panel>
      </Section>

      {/* ---------- Instagram ---------- */}
      <Section title="Instagram" action={chip("instagram")}>
        <Panel>
          <p className="mb-3 text-[11.5px] leading-relaxed text-ink-500">
            Reikia <strong>Instagram Business</strong> paskyros, susietos su Facebook
            puslapiu, ir ilgalaikio tokeno su teisėmis{" "}
            <code className="rounded bg-surface-muted px-1">instagram_basic</code> ir{" "}
            <code className="rounded bg-surface-muted px-1">instagram_manage_insights</code>.
            Kelias: developers.facebook.com → tavo programa → Graph API Explorer →
            pasirink puslapį → sugeneruok tokeną → pakeisk jį į ilgalaikį.
          </p>
          <ActionForm action={saveSettingsAction} submitLabel="Išsaugoti">
            <input type="hidden" name="provider" value="instagram" />
            <Field
              label="Instagram Business paskyros ID"
              name="igUserId"
              placeholder="17841400000000000"
            />
            <Field
              label="Prieigos tokenas"
              name="accessToken"
              type="password"
              placeholder="EAAG…"
              hint="Įrašytas tokenas niekada nerodomas atgal — matysi tik paskutinius 4 simbolius."
            />
          </ActionForm>
        </Panel>
      </Section>

      {/* ---------- Facebook ---------- */}
      <Section title="Facebook" action={chip("facebook")}>
        <Panel>
          <ActionForm action={saveSettingsAction} submitLabel="Išsaugoti">
            <input type="hidden" name="provider" value="facebook" />
            <Field label="Puslapio ID" name="pageId" placeholder="1000000000000" />
            <Field label="Puslapio tokenas" name="accessToken" type="password" placeholder="EAAG…" />
          </ActionForm>
        </Panel>
      </Section>

      {/* ---------- Website ---------- */}
      <Section title="tjk.lt" action={<Chip tone="positive">veikia be tokeno</Chip>}>
        <Panel>
          <p className="mb-3 text-[11.5px] leading-relaxed text-ink-500">
            WordPress REST API yra viešas, tad nieko konfigūruoti nereikia. Keisk
            adresą tik jei svetainė persikeltų.
          </p>
          <ActionForm action={saveSettingsAction} submitLabel="Išsaugoti">
            <input type="hidden" name="provider" value="website" />
            <Field label="Svetainės adresas" name="baseUrl" placeholder="https://tjk.lt" />
          </ActionForm>
        </Panel>
      </Section>

      {/* ---------- Longrein plan prices ---------- */}
      <Section
        title="Longrein planų kainos"
        action={
          <Chip tone={status("longrein")?.configured ? "positive" : "neutral"}>
            {status("longrein")?.configured ? "įvesta" : "neįvesta"}
          </Chip>
        }
      >
        <Panel>
          <p className="mb-3 text-[11.5px] leading-relaxed text-ink-500">
            Be šių skaičių MRR kortelė lieka tuščia — geriau tuščia negu
            išgalvota. Įvesk mėnesinę kainą eurais už kiekvieną planą.
          </p>
          <ActionForm action={saveSettingsAction} submitLabel="Išsaugoti kainas">
            <input type="hidden" name="provider" value="longrein" />
            <Field label="Starter (€/mėn.)" name="price_starter" inputMode="decimal" placeholder="29" />
            <Field label="Pro (€/mėn.)" name="price_pro" inputMode="decimal" placeholder="59" />
            <Field label="Premium (€/mėn.)" name="price_premium" inputMode="decimal" placeholder="99" />
          </ActionForm>
        </Panel>
      </Section>

      {/* ---------- Gmail briefing ---------- */}
      <Section title="Pašto santrauka" action={chip("briefing", "įvesta", "neįvesta")}>
        <Panel>
          <p className="mb-3 text-[11.5px] leading-relaxed text-ink-500">
            Bendra paslaptis, kuria „tjk-daily-inbox-check“ užduotis
            prisistato siųsdama rytinę santrauką. Sugalvok bet kokį ilgą
            atsitiktinį tekstą, įrašyk jį čia ir tą patį — užduotyje. Kol
            čia tuščia, santraukos endpoint&apos;as atsako 404, tarsi jo nebūtų.
          </p>
          <ActionForm action={saveSettingsAction} submitLabel="Išsaugoti">
            <input type="hidden" name="provider" value="briefing" />
            <Field
              label="Bendra paslaptis"
              name="secret"
              type="password"
              placeholder="ilgas atsitiktinis tekstas"
            />
          </ActionForm>
        </Panel>
      </Section>

      {/* ---------- Monitoring ---------- */}
      <Section
        title="Išorinis stebėjimas"
        action={chip("monitoring", "įvesta", "nebūtina")}
      >
        <Panel>
          <p className="mb-3 text-[11.5px] leading-relaxed text-ink-500">
            Veikimo procentas jau skaičiuojamas savarankiškai — GitHub Actions
            kas 5 min. tikrina <code className="rounded bg-surface-muted px-1">/api/health</code>,
            o rezultatai matomi Longrein ekrane. Papildomo tiekėjo nereikia.
            Jei vis dėlto norėsi SMS pranešimų apie gedimus, nukreipk
            BetterStack arba UptimeRobot į tą patį adresą ir įrašyk raktą čia.
          </p>
          <ActionForm action={saveSettingsAction} submitLabel="Išsaugoti">
            <input type="hidden" name="provider" value="monitoring" />
            <Field label="Tiekėjas" name="vendor" placeholder="betterstack / uptimerobot" />
            <Field label="API raktas" name="apiKey" type="password" placeholder="…" />
          </ActionForm>
        </Panel>
      </Section>

      {/* ---------- Where values come from ---------- */}
      <Section title="Iš kur imami raktai">
        <Panel>
          <p className="text-[12px] leading-relaxed text-ink-600">
            Kiekvieną raktą galima nustatyti dviem būdais: Vercel aplinkos
            kintamuoju arba čia. <strong className="text-ink-800">Laimi tai, ką įvedi čia</strong> —
            kad tokeną galėtum pasikeisti telefonu, be perdiegimo. Ženkliukas
            „iš Vercel“ rodo, kad reikšmė ateina iš aplinkos kintamojo.
          </p>
        </Panel>
      </Section>

      <p className="mb-2 px-1 text-center text-[10.5px] leading-relaxed text-ink-400">
        Prisijungta kaip {ctx?.email ?? "—"}. Ši lenta matoma tik tau — prieiga
        valdoma <code>dashboard_access</code> lentelėje.
      </p>
    </>
  );
}
