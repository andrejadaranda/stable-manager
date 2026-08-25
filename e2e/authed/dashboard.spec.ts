import { test, expect } from "@playwright/test";

// Read-only sweep of the pages a yard owner actually opens.
//
// Deliberately no writes: these run against a real Supabase project, and
// a test suite that quietly creates rows in the database someone is
// running their business on is worse than no test suite. The specs that
// do write live in clients.write.spec.ts behind E2E_ALLOW_WRITES.
//
// What this catches is the failure mode this app is most prone to: a page
// that builds fine and 500s on render because a query, an RLS policy or a
// migration is out of step.

const PAGES = [
  { path: "/dashboard", heading: /^hi/i },
  { path: "/dashboard/clients", heading: /clients/i },
  { path: "/dashboard/horses", heading: /horses/i },
  { path: "/dashboard/calendar", heading: /calendar|schedule/i },
  { path: "/dashboard/finance/invoices", heading: /invoices/i },
  { path: "/dashboard/payments", heading: /payments/i },
  { path: "/dashboard/settings/billing", heading: /billing|subscription|plan/i },
];

test.describe("core pages render for a signed-in owner", () => {
  for (const { path, heading } of PAGES) {
    test(`${path} renders without an error boundary`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `${path} returned an error status`).toBeLessThan(400);

      // app/error.tsx is what a thrown render error looks like to a user.
      // Seeing it here means the page "loaded" and is still broken.
      await expect(
        page.getByRole("heading", { name: /something went wrong/i }),
      ).toHaveCount(0);

      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    });
  }
});

test.describe("invoices", () => {
  test("the invoices page lists invoices or says there are none", async ({ page }) => {
    await page.goto("/dashboard/finance/invoices");

    // Either state is correct — what would be wrong is a blank page, which
    // is what a silently-failing query produces.
    const hasContent = await page
      .locator("table, [data-testid='invoice-row'], text=/no invoices/i")
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasContent, "invoices page rendered neither a list nor an empty state").toBe(true);
  });
});

test.describe("billing", () => {
  // Not clicked on purpose: the click creates a real Stripe Checkout
  // session against whichever mode the keys are in. Asserting the control
  // is present covers the regression that matters — a customer unable to
  // start or manage a subscription.
  test("billing page offers a way to act on the subscription", async ({ page }) => {
    await page.goto("/dashboard/settings/billing");

    await expect(page.getByRole("button").first()).toBeVisible();
  });
});
