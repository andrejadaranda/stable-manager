import { defineConfig, devices } from "@playwright/test";

// Playwright config.
//
// The suite is split in two so that it is useful with or without a test
// account, which matters because most of Longrein sits behind auth and a
// Stripe subscription gate:
//
//   e2e/public/  — no credentials. Runs anywhere, including a fresh
//                  checkout and CI. Covers the routes a stranger can
//                  reach plus the guards that keep them out of the rest.
//   e2e/authed/  — needs E2E_EMAIL and E2E_PASSWORD for a real test
//                  stable. Skipped entirely when those are unset, rather
//                  than failing, so `npx playwright test` is never red
//                  just because someone hasn't set up an account.
//
// Point E2E_BASE_URL at a deployed preview to run against that instead of
// booting a local dev server.

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const HAS_CREDENTIALS = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

// Where auth.setup.ts parks the logged-in cookies so the authenticated
// specs don't each pay for a fresh sign-in.
const STORAGE_STATE = "e2e/.auth/state.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,

  // A stray test.only reaching CI silently shrinks the suite to one test.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",

    // Pin the browser's Accept-Language. Without a NEXT_LOCALE cookie the
    // app picks a language from this header (see i18n/request.ts), so
    // leaving it to the machine's default would make every assertion on
    // visible text pass or fail depending on whose laptop ran the suite.
    locale: "en-US",
  },

  projects: [
    {
      name: "public",
      testDir: "./e2e/public",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Longrein ships as an iOS app through Capacitor and most yard staff
      // use it one-handed in a barn. A layout that only works at 1280px
      // wide is a broken layout.
      name: "public-mobile",
      testDir: "./e2e/public",
      use: { ...devices["iPhone 13"] },
    },
    ...(HAS_CREDENTIALS
      ? [
          {
            name: "setup",
            testDir: "./e2e/authed",
            testMatch: /auth\.setup\.ts/,
            use: { ...devices["Desktop Chrome"] },
          },
          {
            name: "authed",
            testDir: "./e2e/authed",
            testIgnore: /auth\.setup\.ts/,
            dependencies: ["setup"],
            use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
          },
        ]
      : []),
  ],

  // When E2E_BASE_URL is set we're testing something already running
  // (a Vercel preview, staging), so don't start a second server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
