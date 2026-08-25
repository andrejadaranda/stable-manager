import { test, expect } from "@playwright/test";

// The routes a signed-out visitor can reach, and the guards that stop them
// reaching everything else.
//
// None of this needs a test account, which is the point: it runs on a
// fresh checkout and catches the class of bug that has actually bitten
// this codebase — a deploy where the app builds fine but a route 500s or
// an auth guard stops guarding.

test.describe("signed-out routes", () => {
  test("root redirects a signed-out visitor to the login page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("login page renders its form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("login page offers routes out to reset and signup", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("link", { name: /reset it/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /create an account/i })).toBeVisible();
  });

  test("signup page loads", async ({ page }) => {
    const response = await page.goto("/signup");
    expect(response?.status()).toBeLessThan(400);
  });

  // These are linked from the footer and from Stripe checkout. If one of
  // them 404s we find out from a customer, or from Stripe.
  for (const path of ["/legal", "/legal/privacy", "/legal/terms", "/legal/cookies"]) {
    test(`${path} is reachable`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
    });
  }
});

test.describe("auth guard", () => {
  // middleware.ts gates everything under /dashboard. A regression here is
  // a data leak, not a broken page, so it is worth asserting on more than
  // one route.
  for (const path of [
    "/dashboard",
    "/dashboard/clients",
    "/dashboard/horses",
    "/dashboard/finance/invoices",
    "/dashboard/settings/billing",
  ]) {
    test(`${path} redirects to login when signed out`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

test.describe("error handling", () => {
  test("an unknown route renders a 404 rather than crashing", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    expect(response?.status()).toBe(404);
  });
});
