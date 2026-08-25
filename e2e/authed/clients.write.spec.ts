import { test, expect } from "@playwright/test";

// The one flow that writes to the database.
//
// Adding a client is the first thing every new yard does, it touches the
// server action, RLS and the tenant scoping all at once, and it is the
// flow whose breakage would be noticed by a customer within a day.
//
// It is off unless E2E_ALLOW_WRITES=1, because Longrein has no seeded
// test database — the credentials in E2E_EMAIL point at a real stable.
// Run it against a throwaway stable, not the one with paying customers
// in it.

const ALLOW_WRITES = process.env.E2E_ALLOW_WRITES === "1";

test.skip(
  !ALLOW_WRITES,
  "Set E2E_ALLOW_WRITES=1 to run write tests. Use a throwaway stable — this creates a real client record.",
);

test("an owner can create a client and see it in the roster", async ({ page }) => {
  // Stamped so a leftover row is obviously a test artefact and so
  // repeated runs never collide on a unique constraint.
  const name = `E2E Test Client ${Date.now()}`;

  await page.goto("/dashboard/clients");

  await page.getByRole("button", { name: /new client/i }).click();

  const dialog = page.locator('input[name="full_name"]');
  await expect(dialog).toBeVisible();
  await dialog.fill(name);

  await page.getByRole("button", { name: /^create client$/i }).click();

  // The list is server-rendered, so a successful create means a
  // revalidated page containing the new name.
  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
});
