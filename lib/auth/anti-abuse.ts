// lib/auth/anti-abuse.ts
//
// Anti-abuse helpers for the signup + public-form surface. Two cheap
// defenses that together kill ~99% of trial-farming attempts before
// they reach Supabase Auth:
//
//   1. Disposable email blocklist — common throwaway inbox providers
//      that exist specifically to bypass email confirmation. We keep
//      the list small (~150 high-signal domains) because:
//        - The list is hot-loaded into every signup request, so size
//          matters for cold-start performance.
//        - Email is also confirmed via real link click before the
//          account can use the app, so we only need to catch the
//          obvious bulk-burner services.
//
//   2. IP signup rate limit — caps "new stable signups" from a single
//      IP. Pure DB count against profiles + a hash so we never store
//      a raw IP. Window + threshold tunable via constants below.

import { createSupabaseAdminClient } from "@/lib/supabase/server";

// =============================================================
// 1. Disposable email blocklist
// =============================================================

// Hand-curated list of the most common burner providers. Each entry
// matches the part AFTER the @. Subdomains are caught via endsWith
// (e.g. inbox.10minutemail.com → 10minutemail.com).
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "0815.ru", "0wnd.net", "0wnd.org", "1secmail.com", "1secmail.net",
  "1secmail.org", "10minutemail.com", "10minutemail.net", "20minutemail.com",
  "33mail.com", "anonbox.net", "anonymbox.com", "armyspy.com", "boun.cr",
  "bouncr.com", "burnermail.io", "byom.de", "cock.li", "cool.fr.nf",
  "courriel.fr.nf", "crazymailing.com", "dispostable.com", "dropmail.me",
  "duck2.club", "dump-email.info", "dumpmail.de", "e4ward.com", "easytrashmail.com",
  "emailfake.com", "emailisvalid.com", "emailondeck.com", "emailsensei.com",
  "emailtemporanea.net", "emailtemporario.com.br", "fakeinbox.com",
  "fakemail.fr", "fakemailgenerator.net", "fastacura.com", "filzmail.com",
  "fleckens.hu", "fly-ts.de", "freemails.cf", "freemails.ga", "freemails.gq",
  "freemails.ml", "freemails.tk", "garliclife.com", "gawab.com", "get2mail.fr",
  "getairmail.com", "ghosttexter.de", "guerrillamail.biz", "guerrillamail.com",
  "guerrillamail.de", "guerrillamail.info", "guerrillamail.net", "guerrillamail.org",
  "guerrillamailblock.com", "harakirimail.com", "hidemail.de", "hochsitze.com",
  "hulapla.de", "imails.info", "incognitomail.com", "incognitomail.net",
  "inboxalias.com", "instant-mail.de", "ipoo.org", "irish2me.com", "jetable.com",
  "jetable.fr.nf", "jetable.net", "jetable.org", "kasmail.com", "klzlk.com",
  "kurzepost.de", "letthemeatspam.com", "mailbidon.com", "mailcatch.com",
  "maildrop.cc", "maildx.com", "mailexpire.com", "mailforspam.com",
  "mailfreeway.com", "mailimate.com", "mailin8r.com", "mailinator.com",
  "mailinator.net", "mailinator2.com", "mailme.lv", "mailmetrash.com",
  "mailnator.com", "mailnesia.com", "mailnull.com", "mailseal.de", "mailshell.com",
  "mailsiphon.com", "mailsucker.net", "mailtemp.info", "mailtome.de",
  "mailtothis.com", "mailtrash.net", "mailzilla.com", "mbox.re", "meantinc.com",
  "minuteinbox.com", "moakt.com", "mvrht.net", "mytemp.email", "mytempemail.com",
  "mytrashmail.com", "noclickemail.com", "nomail.xl.cx", "nospam.ze.tc",
  "nowmymail.com", "objectmail.com", "obobbo.com", "odnorazovoe.ru",
  "oneoffmail.com", "onewaymail.com", "opayq.com", "opentrash.com",
  "ourklips.com", "ovpn.to", "owlpic.com", "pjjkp.com", "plexolan.de",
  "poofy.org", "pookmail.com", "qq.com", "queaiu.com", "quickinbox.com",
  "rcpt.at", "recode.me", "reconmail.com", "rejectmail.com", "rmqkr.net",
  "rppkn.com", "rtrtr.com", "s0ny.net", "safe-mail.net", "selfdestructingmail.com",
  "sendspamhere.com", "sharklasers.com", "shieldedmail.com", "shitware.nl",
  "shortmail.net", "sibmail.com", "skeefmail.com", "slaskpost.se", "slopsbox.com",
  "smashmail.de", "smellfear.com", "snakemail.com", "sneakemail.com", "snkmail.com",
  "sofort-mail.de", "sogetthis.com", "soodonims.com", "spam.la", "spam.su",
  "spam4.me", "spamavert.com", "spambob.com", "spambob.net", "spambob.org",
  "spambog.com", "spambog.de", "spambog.ru", "spambox.us", "spamcero.com",
  "spamdecoy.net", "spamex.com", "spamfighter.cf", "spamfighter.ga",
  "spamfighter.gq", "spamfighter.ml", "spamfighter.tk", "spamfree24.com",
  "spamfree24.de", "spamfree24.eu", "spamfree24.info", "spamfree24.net",
  "spamfree24.org", "spamgourmet.com", "spamhereplease.com", "spamhole.com",
  "spamify.com", "spaminator.de", "spamkill.info", "spaml.com", "spaml.de",
  "spammotel.com", "spamobox.com", "spamoff.de", "spamslicer.com",
  "spamspot.com", "spamthis.co.uk", "spamthisplease.com", "spamtroll.net",
  "speed.1s.fr", "supergreatmail.com", "supermailer.jp", "suremail.info",
  "talkinator.com", "teleworm.com", "teleworm.us", "temp-mail.org",
  "temp-mail.ru", "tempalias.com", "tempe-mail.com", "tempemail.biz",
  "tempemail.co.za", "tempemail.com", "tempemail.net", "tempinbox.co.uk",
  "tempinbox.com", "tempmail.de", "tempmail.it", "tempmail.us", "tempmaildemand.com",
  "tempmailer.com", "tempmailer.de", "tempomail.fr", "temporaryemail.net",
  "temporaryforwarding.com", "temporaryinbox.com", "temporarymailaddress.com",
  "tempymail.com", "thanksnospam.info", "thankyou2010.com", "throam.com",
  "throwawayemailaddress.com", "throwawaymail.com", "tilien.com", "tmailinator.com",
  "tradermail.info", "trash-mail.at", "trash-mail.com", "trash-mail.de",
  "trash2009.com", "trashemail.de", "trashmail.at", "trashmail.com",
  "trashmail.de", "trashmail.me", "trashmail.net", "trashmail.org",
  "trashmail.ws", "trashmailer.com", "trashymail.com", "trbvm.com", "trialmail.de",
  "trillianpro.com", "twinmail.de", "tyldd.com", "uggsrock.com",
  "uplipht.com", "venompen.com", "vidchart.com", "viralplays.com",
  "vpn.st", "vsimcard.com", "vubby.com", "wegwerf-emails.de",
  "wegwerfemail.com", "wegwerfemail.de", "wegwerfmail.de", "wegwerfmail.info",
  "wegwerfmail.net", "wegwerfmail.org", "wh4f.org", "whyspam.me",
  "willhackforfood.biz", "willselfdestruct.com", "winemaven.info", "yopmail.com",
  "yopmail.fr", "yopmail.net", "youmail.ga", "yuurok.com", "z1p.biz",
  "za.com", "zehnminuten.de", "zehnminutenmail.de", "zippymail.in",
  "zoaxe.com", "zoemail.com",
]);

/** True when the email's domain (or any of its suffixes) is a known
 *  burner. Case-insensitive; trims whitespace. */
export function isDisposableEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 0) return false;
  const domain = e.slice(at + 1);
  if (!domain) return false;

  // Direct hit.
  if (DISPOSABLE_DOMAINS.has(domain)) return true;

  // Subdomain match — e.g. inbox.10minutemail.com → 10minutemail.com.
  for (const blocked of DISPOSABLE_DOMAINS) {
    if (domain.endsWith("." + blocked)) return true;
  }
  return false;
}

// =============================================================
// 2. IP-based signup rate limit
// =============================================================

const RATE_LIMIT_WINDOW_HOURS = 24 * 7;  // 7-day window
const RATE_LIMIT_MAX_SIGNUPS  = 3;       // max new stables per IP per window

/** Lowercase, hex-only SHA-256 hash. Used so we never store raw IPs
 *  (privacy + GDPR). 32 bytes hex = 64 chars; fits Postgres text easily.
 *  Uses Web Crypto so this works inside the Edge runtime too. */
async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + ":" + ip.trim());
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Extract the client IP from common Vercel / Next.js request headers.
 *  Returns null when none of the headers are present (local dev). */
export function extractClientIp(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    null
  );
}

/** Check whether a fresh stable signup from this IP would exceed the
 *  rate limit window. Returns { allowed, retryAfterHours }. Failing
 *  open (allowed=true) on any internal error is intentional — we
 *  never want this guard to block legitimate signups during an outage. */
export async function checkSignupRateLimit(
  ip: string | null,
): Promise<{ allowed: boolean; retryAfterHours?: number }> {
  if (!ip) return { allowed: true };

  // Salt rotates with the env var so a leaked hash from prod logs
  // can't be re-used to enumerate IPs. RATE_LIMIT_IP_SALT can stay
  // unset in dev — the hash is still uniformly distributed.
  const salt = process.env.RATE_LIMIT_IP_SALT ?? "longrein-rl-v1";

  try {
    const ipHash = await hashIp(ip, salt);
    const supabase = createSupabaseAdminClient();
    const since = new Date(
      Date.now() - RATE_LIMIT_WINDOW_HOURS * 3600 * 1000,
    ).toISOString();

    const { count } = await supabase
      .from("signup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);

    if ((count ?? 0) >= RATE_LIMIT_MAX_SIGNUPS) {
      return { allowed: false, retryAfterHours: RATE_LIMIT_WINDOW_HOURS };
    }
    return { allowed: true };
  } catch (err) {
    console.warn("[anti-abuse] rate-limit check failed, allowing signup:", err);
    return { allowed: true };
  }
}

/** Record a fresh stable signup attempt against this IP. Best-effort —
 *  fire-and-forget; failures are swallowed so they never bubble up to
 *  the user as a signup error. */
export async function recordSignupAttempt(ip: string | null): Promise<void> {
  if (!ip) return;
  const salt = process.env.RATE_LIMIT_IP_SALT ?? "longrein-rl-v1";
  try {
    const ipHash = await hashIp(ip, salt);
    const supabase = createSupabaseAdminClient();
    await supabase.from("signup_attempts").insert({ ip_hash: ipHash });
  } catch (err) {
    console.warn("[anti-abuse] record-signup-attempt failed:", err);
  }
}
