import { test, expect } from "@playwright/test";

// SECURITY_HEADERS in next.config.js is duplicated in next.config.ts, and
// Next 14 only reads the .js one. That is exactly the setup where someone
// edits the file they can see in their editor, ships it, and nothing
// changes — which is how the config was lost once already (see the note
// at the top of next.config.js).
//
// These assertions run against the served response, so they check what
// production actually sends rather than what a config file says.

test.describe("security headers", () => {
  test("baseline headers are present on an HTML response", async ({ page }) => {
    const response = await page.goto("/login");
    const headers = response!.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  test("CSP still allows Stripe and Supabase and nothing wilder", async ({ page }) => {
    const response = await page.goto("/login");
    const csp = response!.headers()["content-security-policy"];

    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");

    // Stripe Checkout mounts an iframe and calls its API. Drop either of
    // these from the policy and payments break in the browser only —
    // every server-side test still passes.
    expect(csp).toContain("https://js.stripe.com");
    expect(csp).toContain("https://api.stripe.com");
    expect(csp).toContain("https://*.supabase.co");

    // Clickjacking and base-tag injection guards.
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");

    // Sentry events go through the /monitoring tunnel precisely so that
    // no third-party host has to be added here. If someone "fixes" a
    // blocked request by allowlisting sentry.io instead, this catches it
    // and points them back at tunnelRoute in next.config.js.
    expect(csp).not.toContain("sentry.io");
  });
});
