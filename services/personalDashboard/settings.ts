// Integration settings — the API tokens and per-integration config she
// pastes in herself.
//
// Secrets policy for this module:
//   * Values live in dashboard_integration_settings, RLS-locked to her
//     own rows and gated on dashboard_is_allowed().
//   * getIntegrationConfig() returns the RAW config and is server-only.
//     It must never be called from, or its result passed to, a client
//     component.
//   * getIntegrationStatus() is the client-safe view: it says whether a
//     provider is configured and shows a masked tail, never the token.
//
// Storing a long-lived Instagram token in a database column is not
// ideal — it is readable by anyone with service-role access (i.e.
// Vercel env access, i.e. her). That is an acceptable trade for a
// single-operator internal tool, and it is the only option that lets her
// rotate a token from her phone without a redeploy. Anything stronger
// (KMS, per-value encryption) would need a key that lives... in an env
// var, which is where we started.

// (No `import "server-only"` guard: that package isn't a dependency of
// this repo and adding one just for this file isn't worth the lockfile
// churn. The convention here — services/* are server-side, like every
// other file in this folder — is enforced by review, same as the rest of
// the codebase.)

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { requirePersonalContext, safe } from "@/services/personalDashboard/common";

export type Provider =
  | "instagram"
  | "facebook"
  | "website"
  | "anthropic"
  | "monitoring"
  | "longrein"
  // Shared secret the Gmail scheduled task authenticates with.
  | "briefing"
  // VAPID keypair for Web Push. Generated on first subscribe if absent.
  | "push";

// -------------------------------------------------------------------
// Environment fallbacks
// -------------------------------------------------------------------
// Every integration can be configured two ways: an environment variable
// on Vercel, or a row she pastes in from the Settings screen on her
// phone.
//
// The DB value wins. That ordering is deliberate: changing a Vercel env
// var needs a redeploy and a laptop, whereas a token she can rotate from
// her phone at the yard is the difference between an integration that
// stays working and one that quietly dies the first time Meta expires a
// token. The env var is the floor, not the ceiling.
const ENV_KEYS: Partial<Record<Provider, Record<string, string>>> = {
  instagram: {
    igUserId: "META_IG_USER_ID",
    accessToken: "META_INSTAGRAM_ACCESS_TOKEN",
  },
  facebook: {
    pageId: "META_PAGE_ID",
    accessToken: "META_FB_PAGE_ACCESS_TOKEN",
  },
  website: { baseUrl: "PERSONAL_WEBSITE_URL" },
  anthropic: { apiKey: "ANTHROPIC_API_KEY" },
  briefing: { secret: "PERSONAL_BRIEFING_SECRET" },
  push: {
    publicKey: "VAPID_PUBLIC_KEY",
    privateKey: "VAPID_PRIVATE_KEY",
    subject: "VAPID_SUBJECT",
  },
};

function envConfig(provider: Provider): Record<string, unknown> {
  const map = ENV_KEYS[provider];
  if (!map) return {};
  const out: Record<string, unknown> = {};
  for (const [field, envName] of Object.entries(map)) {
    const value = process.env[envName];
    if (typeof value === "string" && value.trim().length > 0) out[field] = value.trim();
  }
  return out;
}

export type IntegrationStatus = {
  provider: Provider;
  configured: boolean;
  /** e.g. "…F3aQ" — enough to tell two tokens apart, useless if leaked. */
  maskedHint: string | null;
  updatedAt: string | null;
  /** True when the value comes from a Vercel env var rather than the DB. */
  fromEnv: boolean;
};

/**
 * SERVER ONLY. The full config including secrets, with environment
 * variables merged in underneath the stored values.
 *
 * Returns null when neither source has anything, so every caller can keep
 * using `if (!cfg) return []` to mean "not configured".
 */
export async function getIntegrationConfig(
  provider: Provider,
): Promise<Record<string, unknown> | null> {
  return safe(
    async () => {
      const ctx = await requirePersonalContext();
      const supabase = createSupabaseServerClient();
      const { data } = await supabase
        .from("dashboard_integration_settings")
        .select("config")
        .eq("auth_user_id", ctx.authUserId)
        .eq("provider", provider)
        .maybeSingle();
      return mergeWithEnv(provider, data?.config as Record<string, unknown> | undefined);
    },
    // Fall back to env even when the DB read fails: an unapplied
    // migration shouldn't disable an integration that env alone can run.
    Object.keys(envConfig(provider)).length > 0 ? envConfig(provider) : null,
    `getIntegrationConfig(${provider})`,
  );
}

/**
 * The same lookup for a caller with no session — cron routes and the
 * push sender, which run as the platform rather than as her.
 *
 * The user id must come from `dashboard_access` (the allowlist), never
 * from a request body. Callers are responsible for that; this function
 * is a plain read.
 */
export async function getIntegrationConfigForUser(
  authUserId: string,
  provider: Provider,
): Promise<Record<string, unknown> | null> {
  return safe(
    async () => {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("dashboard_integration_settings")
        .select("config")
        .eq("auth_user_id", authUserId)
        .eq("provider", provider)
        .maybeSingle();
      return mergeWithEnv(provider, data?.config as Record<string, unknown> | undefined);
    },
    Object.keys(envConfig(provider)).length > 0 ? envConfig(provider) : null,
    `getIntegrationConfigForUser(${provider})`,
  );
}

/** Write a config for a user with no session. Used when the push sender
 *  generates a VAPID keypair on first use. */
export async function saveIntegrationConfigForUser(
  authUserId: string,
  provider: Provider,
  config: Record<string, unknown>,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("dashboard_integration_settings")
    .select("config")
    .eq("auth_user_id", authUserId)
    .eq("provider", provider)
    .maybeSingle();

  const { error } = await admin.from("dashboard_integration_settings").upsert(
    {
      auth_user_id: authUserId,
      provider,
      config: { ...((data?.config as Record<string, unknown>) ?? {}), ...config },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id,provider" },
  );
  if (error) throw error;
}

function mergeWithEnv(
  provider: Provider,
  stored: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  const merged = { ...envConfig(provider), ...(stored ?? {}) };
  return Object.keys(merged).length > 0 ? merged : null;
}

/** Client-safe. Never includes a secret value. */
export async function getIntegrationStatuses(
  providers: Provider[],
): Promise<IntegrationStatus[]> {
  // Explicit type argument: inference from the success branch would fix
  // updatedAt as `string` and reject the all-nulls fallback.
  return safe<IntegrationStatus[]>(
    async () => {
      const ctx = await requirePersonalContext();
      const supabase = createSupabaseServerClient();
      const { data } = await supabase
        .from("dashboard_integration_settings")
        .select("provider, config, updated_at")
        .eq("auth_user_id", ctx.authUserId);

      const byProvider = new Map(
        (data ?? []).map((r) => [String(r.provider), r]),
      );

      return providers.map((provider) => {
        const row = byProvider.get(provider);
        const stored = (row?.config ?? {}) as Record<string, unknown>;
        const env = envConfig(provider);
        const cfg = { ...env, ...stored };
        const secret = firstSecretValue(cfg);
        return {
          provider,
          configured: Object.keys(cfg).length > 0,
          maskedHint: secret ? `…${secret.slice(-4)}` : null,
          updatedAt: (row?.updated_at as string) ?? null,
          fromEnv: Object.keys(stored).length === 0 && Object.keys(env).length > 0,
        };
      });
    },
    providers.map((provider) => ({
      provider,
      configured: Object.keys(envConfig(provider)).length > 0,
      maskedHint: null,
      updatedAt: null,
      fromEnv: Object.keys(envConfig(provider)).length > 0,
    })),
    "getIntegrationStatuses",
  );
}

// Keys whose values are secrets and must never round-trip to a browser.
const SECRET_KEYS = ["accessToken", "apiKey", "token", "secret"];

function firstSecretValue(cfg: Record<string, unknown>): string | null {
  for (const k of SECRET_KEYS) {
    const v = cfg[k];
    if (typeof v === "string" && v.length >= 4) return v;
  }
  return null;
}

/** Upsert one provider's config. Called from the Settings server action. */
export async function saveIntegrationConfig(
  provider: Provider,
  config: Record<string, unknown>,
): Promise<void> {
  const ctx = await requirePersonalContext();
  const supabase = createSupabaseServerClient();

  // Merge rather than replace, so saving just the Instagram account id
  // doesn't wipe the token that was saved a minute earlier.
  const existing = (await getIntegrationConfig(provider)) ?? {};
  const merged: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(config)) {
    // An empty string means "clear this field" — otherwise a blank input
    // on a partially-filled form would silently erase a good token.
    if (v === "" || v === null || v === undefined) delete merged[k];
    else merged[k] = v;
  }

  const { error } = await supabase
    .from("dashboard_integration_settings")
    .upsert(
      {
        auth_user_id: ctx.authUserId,
        provider,
        config: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "auth_user_id,provider" },
    );

  if (error) throw error;
}
