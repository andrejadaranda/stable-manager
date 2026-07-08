// APNs (Apple Push Notification service) sender — token-based (.p8) auth over
// HTTP/2. Dormant until all APNS_* env vars are set, so apnsConfigured() gates
// every caller and nothing breaks before the key exists.
//
// Required env (added in Vercel by Andrėja — Claude never handles the secret):
//   APNS_KEY       — contents of the AuthKey_XXXX.p8 (PEM; \n may be escaped)
//   APNS_KEY_ID    — the 10-char Key ID of that .p8
//   APNS_TEAM_ID   — the 10-char Apple Developer Team ID
//   APNS_BUNDLE_ID — the app bundle id, e.g. eu.longrein.app  (apns-topic)
//   APNS_ENV       — "production" (default) | "sandbox"
//
// A provider JWT is valid up to 60 min and reusable across sends — we cache it
// ~50 min. Apple returns 410 for a dead token (BadDeviceToken/Unregistered);
// callers use that to prune.

import http2 from "http2";
import { createPrivateKey, sign as cryptoSign } from "crypto";

export type ApnsPayload = { title: string; body: string; url?: string };
export type ApnsResult = { token: string; status: number; reason?: string; dead: boolean };

export function apnsConfigured(): boolean {
  return Boolean(
    process.env.APNS_KEY &&
      process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_BUNDLE_ID,
  );
}

function apnsHost(): string {
  return (process.env.APNS_ENV ?? "production") === "sandbox"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

let cachedJwt: { token: string; iat: number } | null = null;

function providerJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.iat < 50 * 60) return cachedJwt.token;

  const keyId = process.env.APNS_KEY_ID!;
  const teamId = process.env.APNS_TEAM_ID!;
  // Env vars often store the PEM with literal "\n" — normalise back to newlines.
  const pem = (process.env.APNS_KEY ?? "").replace(/\\n/g, "\n");

  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: now }));
  const signingInput = `${header}.${claims}`;

  const signature = cryptoSign(
    "sha256",
    Buffer.from(signingInput),
    { key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" },
  );
  const jwt = `${signingInput}.${base64url(signature)}`;
  cachedJwt = { token: jwt, iat: now };
  return jwt;
}

/**
 * Send one alert push to a batch of device tokens over a single HTTP/2 session.
 * Returns a per-token result; `dead` marks tokens the caller should delete.
 * No-op (empty array) when APNs isn't configured.
 */
export async function sendApns(tokens: string[], payload: ApnsPayload): Promise<ApnsResult[]> {
  if (!apnsConfigured() || tokens.length === 0) return [];

  let jwt: string;
  try {
    jwt = providerJwt();
  } catch {
    // Malformed key — treat as unconfigured rather than throwing into the cron.
    return [];
  }

  const topic = process.env.APNS_BUNDLE_ID!;
  const body = JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
    ...(payload.url ? { url: payload.url } : {}),
  });

  const client = http2.connect(apnsHost());
  const results: ApnsResult[] = [];

  const fail = (): void => {
    for (const t of tokens) results.push({ token: t, status: 0, dead: false });
  };

  try {
    await new Promise<void>((resolveSession) => {
      let pending = tokens.length;
      client.on("error", () => {
        if (results.length === 0) fail();
        resolveSession();
      });

      for (const token of tokens) {
        const req = client.request({
          ":method": "POST",
          ":path": `/3/device/${token}`,
          authorization: `bearer ${jwt}`,
          "apns-topic": topic,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        });

        let status = 0;
        let respBody = "";
        req.on("response", (headers) => {
          status = Number(headers[":status"]) || 0;
        });
        req.setEncoding("utf8");
        req.on("data", (chunk) => { respBody += chunk; });
        req.on("end", () => {
          let reason: string | undefined;
          if (respBody) {
            try { reason = (JSON.parse(respBody) as { reason?: string }).reason; } catch { /* ignore */ }
          }
          const dead = status === 410 || reason === "BadDeviceToken" || reason === "Unregistered";
          results.push({ token, status, reason, dead });
          pending -= 1;
          if (pending === 0) resolveSession();
        });
        req.on("error", () => {
          results.push({ token, status: 0, dead: false });
          pending -= 1;
          if (pending === 0) resolveSession();
        });
        req.end(body);
      }
    });
  } finally {
    try { client.close(); } catch { /* noop */ }
  }

  return results;
}
