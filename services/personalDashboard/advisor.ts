// The proactive advisor: three to five things worth doing today, written
// once per morning from a snapshot of everything the other screens show.
//
// Two design decisions worth stating plainly:
//
// 1. Generation is idempotent per (user, day). dashboard_ai_recommendations
//    has a unique index on (auth_user_id, generated_on), and this module
//    reads before it writes. Opening the dashboard ten times in a morning
//    costs one model call, not ten. That is the difference between a
//    feature she can leave running and one she has to think about.
//
// 2. The rule-based signals are computed FIRST and passed in as input.
//    "This client hasn't ridden in 34 days" and "revenue is 12% behind
//    pace" are arithmetic — they should not depend on a model getting them
//    right. The model's job is to prioritise and phrase, not to compute.

import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requirePersonalContext,
  getStableTimeZone,
  safe,
} from "@/services/personalDashboard/common";
import { localDateKey, formatEur } from "@/services/personalDashboard/core.pure";
import { getReengagementList, getOpenTodos, getTodayLessons } from "@/services/personalDashboard/tjk";
import { getFinanceSnapshot } from "@/services/personalDashboard/finance";
import { getMarketingSnapshot } from "@/services/personalDashboard/marketing";
import { getLongreinHealth } from "@/services/personalDashboard/longrein";
import { getIntegrationConfig } from "@/services/personalDashboard/settings";

export type Recommendation = {
  id: string;
  title: string;
  body: string;
  category: "tjk" | "finansai" | "rinkodara" | "longrein" | "tikslai";
  priority: "high" | "medium" | "low";
};

export type AdvisorResult = {
  recommendations: Recommendation[];
  generatedOn: string;
  model: string | null;
  /** Why there's nothing to show, when there isn't. Drives the empty state. */
  status: "ok" | "not_generated" | "not_configured" | "failed" | "refused";
};

/** Read-only. Never triggers a model call — safe to call on every render. */
export async function getTodayRecommendations(now = new Date()): Promise<AdvisorResult> {
  // Explicit type argument: without it TypeScript narrows T from the
  // success branch's literal statuses and rejects the "failed" fallback.
  return safe<AdvisorResult>(
    async () => {
      const ctx = await requirePersonalContext();
      const tz = await getStableTimeZone();
      const today = localDateKey(now, tz);
      const supabase = createSupabaseServerClient();

      const { data } = await supabase
        .from("dashboard_ai_recommendations")
        .select("recommendations, model, generated_on")
        .eq("auth_user_id", ctx.authUserId)
        .eq("generated_on", today)
        .maybeSingle();

      if (!data) {
        return {
          recommendations: [],
          generatedOn: today,
          model: null,
          status: (await getApiKey())
            ? ("not_generated" as const)
            : ("not_configured" as const),
        };
      }

      return {
        recommendations: (data.recommendations as Recommendation[]) ?? [],
        generatedOn: String(data.generated_on),
        model: (data.model as string) ?? null,
        status: "ok" as const,
      };
    },
    {
      recommendations: [],
      generatedOn: "",
      model: null,
      status: "failed" as const,
    },
    "getTodayRecommendations",
  );
}

/**
 * The Anthropic key, from whichever source has one.
 *
 * `ANTHROPIC_API_KEY` on Vercel is checked first, then the key she pastes
 * into Settings. Both work; the second one exists because she can reach
 * it from her phone and the first needs a laptop and a redeploy.
 *
 * Returns null when neither is set — which is a normal state, not an
 * error. The dashboard renders an empty advisor card and everything else
 * on the screen keeps working.
 */
async function getApiKey(): Promise<string | null> {
  const cfg = await getIntegrationConfig("anthropic");
  const key = cfg?.apiKey;
  return typeof key === "string" && key.trim().length > 0 ? key.trim() : null;
}

/**
 * Generate today's advice, unless it already exists.
 *
 * `force` re-runs it — used by the "regenerate" button when the morning's
 * advice is stale because she has since worked through half of it.
 */
export async function generateRecommendations(
  opts: { force?: boolean; now?: Date } = {},
): Promise<AdvisorResult> {
  const now = opts.now ?? new Date();
  const ctx = await requirePersonalContext();
  const tz = await getStableTimeZone();
  const today = localDateKey(now, tz);

  if (!opts.force) {
    const existing = await getTodayRecommendations(now);
    if (existing.status === "ok") return existing;
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    return { recommendations: [], generatedOn: today, model: null, status: "not_configured" };
  }

  const snapshot = await buildSnapshot(now);

  const client = new Anthropic({ apiKey });
  const model = "claude-opus-5";

  let parsed: { recommendations: Recommendation[] } | null = null;
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      // Thinking is on by default on Claude Opus 5. `max_tokens` caps
      // thinking + output together, hence the generous ceiling.
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          schema: RECOMMENDATION_SCHEMA,
        },
      },
      // Server-side fallback: if a safety classifier ever declines the
      // request, the API re-runs it on the recommended fallback model in
      // the same call rather than handing back a refusal. Vanishingly
      // unlikely for stable-management data, but it costs nothing to have.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Šiandien ${today}. Štai šios dienos duomenys:\n\n${JSON.stringify(snapshot, null, 2)}`,
        },
      ],
    });

    // A refusal is a successful HTTP 200 with an empty/partial content
    // array — reading content[0] unconditionally would throw.
    if (response.stop_reason === "refusal") {
      return { recommendations: [], generatedOn: today, model, status: "refused" };
    }

    const text = response.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    parsed = JSON.parse(text);
  } catch (err) {
    console.error("[personal-dashboard] advisor generation failed:", err);
    return { recommendations: [], generatedOn: today, model, status: "failed" };
  }

  // Trust the schema for shape, but cap the count here rather than in the
  // schema: JSON Schema array-length constraints aren't supported by
  // structured outputs, so "3 to 5" lives in the prompt and is enforced here.
  const recommendations = (parsed?.recommendations ?? []).slice(0, 5);

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("dashboard_ai_recommendations").upsert(
    {
      auth_user_id: ctx.authUserId,
      generated_on: today,
      model,
      recommendations,
      snapshot,
    },
    { onConflict: "auth_user_id,generated_on" },
  );
  if (error) console.error("[personal-dashboard] advisor persist failed:", error);

  return { recommendations, generatedOn: today, model, status: "ok" };
}

// -------------------------------------------------------------------

const SYSTEM_PROMPT = `Tu esi Andrėjos asmeninė asistentė. Ji vadovauja jojimo klubui (TJK) ir kartu kuria "Longrein" — programinę įrangą arklidėms.

Kas rytą gauni jos verslo duomenų nuotrauką ir parenki 3–5 dalykus, kuriuos verta padaryti ŠIANDIEN.

Taisyklės:
- Rašyk lietuviškai, šiltai ir konkrečiai — kaip kolegė, ne kaip ataskaita.
- Kiekviena rekomendacija turi būti VEIKSMAS, kurį galima atlikti šiandien. Ne "pagalvok apie rinkodarą", o "parašyk Justei — nejojo 21 d.".
- Remkis TIK pateiktais skaičiais. Niekada neišgalvok vardų, sumų ar datų. Jei duomenų trūksta, tos temos neliesk.
- Skaičiavimai jau atlikti už tave — tavo darbas surikiuoti pagal svarbą ir suformuluoti, o ne perskaičiuoti.
- Pirmenybė: pinigai ir klientai, kuriuos galima prarasti, svarbiau nei rinkodara. Skubūs dalykai — pirmi.
- Nekartok to paties dalyko dviem rekomendacijomis.
- "body" — 1–2 sakiniai. Trumpai.`;

// additionalProperties:false + explicit `required` on every object is a
// hard requirement of structured outputs.
const RECOMMENDATION_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "trumpas slug, pvz. 'skambink-justei'" },
          title: { type: "string", description: "iki 60 simbolių" },
          body: { type: "string", description: "1–2 sakiniai" },
          category: {
            type: "string",
            enum: ["tjk", "finansai", "rinkodara", "longrein", "tikslai"],
          },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["id", "title", "body", "category", "priority"],
        additionalProperties: false,
      },
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
} as const;

/**
 * The numbers the advice is built from.
 *
 * Deliberately small and pre-digested: names + a handful of figures, not
 * raw rows. It keeps the prompt cheap, keeps client data exposure to the
 * minimum the task needs, and — most importantly — means the model is
 * never the thing computing "days since last ride".
 */
async function buildSnapshot(now: Date): Promise<Record<string, unknown>> {
  const [reengagement, todos, todayLessons, finance, marketing, health] = await Promise.all([
    getReengagementList(now),
    getOpenTodos(now),
    getTodayLessons(now),
    getFinanceSnapshot(now),
    getMarketingSnapshot(now),
    getLongreinHealth(now),
  ]);

  return {
    tjk: {
      treniruotes_siandien: todayLessons.length,
      neaktyvus_klientai: reengagement.slice(0, 8).map((r) => ({
        vardas: r.fullName,
        dienu_nuo_paskutinio_jojimo: r.daysSince,
        busena: r.tone,
      })),
      neaktyviu_is_viso: reengagement.length,
      neatlikti_darbai: todos.slice(0, 8).map((t) => ({
        uzduotis: t.body,
        veluoja: t.overdue,
      })),
    },
    finansai: {
      uzdirbta_si_menesi: formatEur(finance.forecast.earnedToDate),
      laukia_apmokejimo: formatEur(finance.forecast.outstanding),
      jau_uzsakyta_likusiam_menesiui: formatEur(finance.forecast.booked),
      prognoze_menesio_pabaigai: formatEur(finance.forecast.bookedForecast),
      menesio_tikslas: finance.goal
        ? {
            tikslas: formatEur(finance.goal.target),
            pasiekta: formatEur(finance.goal.actual),
            busena: finance.goal.status,
            skirtumas_nuo_tempo: formatEur(finance.goal.paceDelta),
          }
        : null,
      neapmoketu_saskaitu: finance.unpaid.length,
      neapmoketa_suma: formatEur(finance.totalOutstanding),
    },
    rinkodara: {
      irasu_per_7_dienas: marketing.postsLast7,
      irasu_ankstesne_savaite: marketing.postsPrev7,
      spragos: marketing.gaps.map((g) => g.title),
      geriausi_irasai: marketing.top.map((p) => ({
        platforma: p.platform,
        tipas: p.mediaType,
        reakcijos: p.likes + p.comments,
      })),
      prijungta: marketing.configured,
    },
    longrein: {
      arklidziu_is_viso: health.stables.total,
      naujos_per_30_d: health.stables.newLast30,
      buvo_pries_tai: health.stables.newPrev30,
      aktyvus_vartotojai_7_d: health.users.activeLast7,
      laukiancinuju_sarasas: health.waitlist.total,
      nauji_laukiantieji_7_d: health.waitlist.last7,
      prenumeratos: health.subscriptions,
    },
  };
}
