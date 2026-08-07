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
import { connectMetaAction } from "@/app/personal/social-actions";

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

      {/* ---------- Meta: the guided connect ---------- */}
      <Section
        title="Instagram ir Facebook"
        action={
          <Chip
            tone={
              status("instagram")?.configured && status("facebook")?.configured
                ? "positive"
                : status("facebook")?.configured
                  ? "warning"
                  : "neutral"
            }
          >
            {status("instagram")?.configured && status("facebook")?.configured
              ? "prijungta"
              : status("facebook")?.configured
                ? "tik Facebook"
                : "neprijungta"}
          </Chip>
        }
      >
        <Panel>
          <p className="mb-2 text-[11.5px] leading-relaxed text-ink-500">
            Šitas mygtukas padaro sunkiąją dalį: trumpalaikį tokeną paverčia
            ilgalaikiu, susiranda tavo puslapį ir prie jo prikabintą Instagram
            Business profilį, ir viską įrašo. Tau reikia trijų dalykų iš{" "}
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              developers.facebook.com
            </a>
            :
          </p>
          <ol className="mb-3 ml-4 list-decimal space-y-1.5 text-[11.5px] leading-relaxed text-ink-600">
            <li>
              <strong>App ID</strong> ir <strong>App Secret</strong> — programos
              puslapyje, Settings → Basic.
            </li>
            <li>
              <strong>Trumpalaikis tokenas</strong> — Tools →{" "}
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Graph API Explorer
              </a>
              , pasirink savo programą, tada „Generate Access Token“.
            </li>
            <li>
              Teisės, kurias reikia pažymėti:{" "}
              <code className="rounded bg-surface-muted px-1 text-[10.5px]">
                pages_show_list, pages_read_engagement, pages_manage_posts,
                instagram_basic, instagram_content_publish,
                instagram_manage_insights
              </code>
            </li>
          </ol>
          <p className="mb-3 rounded-lg bg-surface-muted/70 px-2.5 py-2 text-[11px] leading-relaxed text-ink-600">
            App Secret panaudojamas tik mainams ir <strong>neįrašomas</strong> —
            jo daugiau niekur nereikia, o laikyti be reikalo būtų kvaila.
            Ilgalaikis puslapio tokenas nebesibaigia tol, kol nepakeiti
            Facebook slaptažodžio.
          </p>

          <ActionForm action={connectMetaAction} submitLabel="Prijungti">
            <Field label="App ID" name="appId" placeholder="1234567890123456" />
            <Field label="App Secret" name="appSecret" type="password" placeholder="…" />
            <Field
              label="Trumpalaikis tokenas"
              name="shortLivedToken"
              type="password"
              placeholder="EAAG…"
            />
            <Field
              label="Puslapio ID (nebūtina)"
              name="pageId"
              placeholder="palik tuščią, jei puslapis vienas"
              hint="Užpildyk tik jei administruoji kelis puslapius."
            />
          </ActionForm>
        </Panel>

        {/* Manual entry stays as the escape hatch: if the exchange fails
            for a reason Meta words badly, she can still paste a token she
            obtained another way. */}
        <details className="mt-2.5">
          <summary className="cursor-pointer px-1 text-[11.5px] text-ink-400">
            Arba suvesti tokenus ranka
          </summary>
          <Panel className="mt-2">
            <ActionForm action={saveSettingsAction} submitLabel="Išsaugoti Instagram">
              <input type="hidden" name="provider" value="instagram" />
              <Field label="Instagram Business ID" name="igUserId" placeholder="17841400000000000" />
              <Field label="Tokenas" name="accessToken" type="password" placeholder="EAAG…" />
            </ActionForm>
            <div className="mt-4 border-t border-ink-100 pt-3">
              <ActionForm action={saveSettingsAction} submitLabel="Išsaugoti Facebook">
                <input type="hidden" name="provider" value="facebook" />
                <Field label="Puslapio ID" name="pageId" placeholder="1000000000000" />
                <Field label="Puslapio tokenas" name="accessToken" type="password" placeholder="EAAG…" />
              </ActionForm>
            </div>
          </Panel>
        </details>
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
