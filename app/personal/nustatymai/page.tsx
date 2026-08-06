// Settings — where she pastes the tokens the integrations need.
//
// Not in the bottom tab bar: it's a setup screen, visited a handful of
// times, and a sixth tab would push the other five below thumb comfort.
// Reached from the Today screen and from each empty state that needs it.

import { getIntegrationStatuses } from "@/services/personalDashboard/settings";
import { getPersonalContext } from "@/lib/personal/access";
import { ScreenHeader, Section, Panel, Chip, Empty } from "@/components/personal/ui";
import { ActionForm, Field } from "@/components/personal/interactive";
import { saveSettingsAction } from "@/app/personal/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nustatymai" };

export default async function SettingsScreen() {
  const ctx = await getPersonalContext();
  const statuses = await getIntegrationStatuses([
    "instagram",
    "facebook",
    "website",
    "monitoring",
    "longrein",
  ]);
  const status = (p: string) => statuses.find((s) => s.provider === p);

  return (
    <>
      <ScreenHeader eyebrow="Konfigūracija" title="Nustatymai" />

      {/* ---------- Instagram ---------- */}
      <Section
        title="Instagram"
        action={
          <Chip tone={status("instagram")?.configured ? "positive" : "neutral"}>
            {status("instagram")?.configured
              ? `prijungta ${status("instagram")?.maskedHint ?? ""}`
              : "neprijungta"}
          </Chip>
        }
      >
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
      <Section
        title="Facebook"
        action={
          <Chip tone={status("facebook")?.configured ? "positive" : "neutral"}>
            {status("facebook")?.configured ? "prijungta" : "neprijungta"}
          </Chip>
        }
      >
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

      {/* ---------- Monitoring ---------- */}
      <Section
        title="Veikimo stebėjimas"
        action={
          <Chip tone={status("monitoring")?.configured ? "positive" : "neutral"}>
            {status("monitoring")?.configured ? "įvesta" : "neprijungta"}
          </Chip>
        }
      >
        <Panel>
          <Empty
            title="Kol kas tik laukas duomenims"
            detail="Įvesti raktą gali jau dabar, bet Longrein kortelė jo dar nenaudoja — pirma reikia prijungti patį Sentry (ar UptimeRobot) prie projekto. Tai atskiras darbas, aprašytas perdavimo dokumente."
          />
          <div className="mt-3">
            <ActionForm action={saveSettingsAction} submitLabel="Išsaugoti">
              <input type="hidden" name="provider" value="monitoring" />
              <Field label="Tiekėjas" name="vendor" placeholder="sentry / uptimerobot" />
              <Field label="API raktas" name="apiKey" type="password" placeholder="…" />
            </ActionForm>
          </div>
        </Panel>
      </Section>

      {/* ---------- Env-var-only settings ---------- */}
      <Section title="Ko čia įvesti negalima">
        <Panel>
          <ul className="space-y-2.5 text-[12px] leading-relaxed text-ink-600">
            <li>
              <strong className="text-ink-800">ANTHROPIC_API_KEY</strong> — asistentės
              raktas. Gyvena Vercel aplinkos kintamuosiuose, ne duomenų bazėje: juo
              naudojasi serveris, o ne tavo sesija.
            </li>
            <li>
              <strong className="text-ink-800">PERSONAL_BRIEFING_SECRET</strong> — bendra
              paslaptis, kuria Gmail užduotis autentifikuojasi siųsdama rytinę
              santrauką. Taip pat Vercel kintamuosiuose.
            </li>
          </ul>
        </Panel>
      </Section>

      <p className="mb-2 px-1 text-center text-[10.5px] leading-relaxed text-ink-400">
        Prisijungta kaip {ctx?.email ?? "—"}. Ši lenta matoma tik tau — prieiga
        valdoma <code>dashboard_access</code> lentelėje.
      </p>
    </>
  );
}
