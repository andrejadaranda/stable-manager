import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

// Signs in once and parks the session cookies on disk. Every spec in the
// "authed" project starts from that state instead of paying for its own
// sign-in, which keeps the suite fast and — more usefully — means a
// broken login shows up as one failed setup rather than as every
// authenticated test failing for a reason that isn't their own.
//
// This file only runs when E2E_EMAIL and E2E_PASSWORD are set; see the
// project list in playwright.config.ts.

const STORAGE_STATE = path.join("e2e", ".auth", "state.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL!;
  const password = process.env.E2E_PASSWORD!;

  await page.goto("/login");

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // middleware.ts sends an authenticated user at /login to /dashboard, so
  // landing anywhere under /dashboard means the session cookie took.
  // The subscription gate may bounce us straight on to the billing page —
  // that is still a successful login, so accept both.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
});
