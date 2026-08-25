# End-to-end tests

Browser tests for Longrein, run with [Playwright](https://playwright.dev).

```bash
npm run test:e2e          # everything that can run with what's configured
npm run test:e2e:ui       # interactive runner — best for writing new tests
npm run test:e2e:report   # open the report from the last run
```

The suite boots its own `next dev` server, so nothing needs to be running
first. It uses whatever is in `.env.local`.

## What runs, and when

| Directory | Needs | Notes |
|---|---|---|
| `e2e/public/` | nothing | Signed-out routes, auth guards, security headers. Always runs. |
| `e2e/authed/` | `E2E_EMAIL`, `E2E_PASSWORD` | Read-only sweep of the owner-facing pages. Skipped when unset. |
| `e2e/authed/clients.write.spec.ts` | the above **plus** `E2E_ALLOW_WRITES=1` | Creates a real client record. Off by default. |

Two browser engines are covered: Chromium at desktop width, and **WebKit
at iPhone width**. The second one is not decoration — the iOS build runs
in `WKWebView` via Capacitor, so WebKit is the engine real customers use
on their phones, and it has its own layout and date-parsing quirks.

## Running the authenticated tests

There is no seeded test database. `E2E_EMAIL` points at a real Supabase
account in a real stable, which is why writes are gated behind a second
flag and why the default specs only read.

**Use a throwaway stable, not one with paying customers in it.**

```bash
E2E_EMAIL=test@example.com E2E_PASSWORD=... npm run test:e2e
```

Sign-in happens once in `auth.setup.ts` and the session is reused from
`e2e/.auth/state.json` (gitignored).

## Running against a deployed environment

```bash
E2E_BASE_URL=https://longrein-git-my-branch.vercel.app npm run test:e2e
```

With `E2E_BASE_URL` set, no local dev server is started.

## First-time setup on a new machine

```bash
npx playwright install chromium webkit
```

## Adding tests

Keep anything that writes to the database in a `*.write.spec.ts` file
guarded by `E2E_ALLOW_WRITES`, and name the records it creates so a
leftover row is obviously a test artefact.
