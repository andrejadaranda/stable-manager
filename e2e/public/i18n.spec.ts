import { test, expect } from "@playwright/test";

// Language selection.
//
// Worth testing rather than eyeballing, because the two ways it can break
// are both invisible: a switch that sets the cookie but doesn't
// re-render (the layout wasn't revalidated), and a switch that renders
// but doesn't persist (the cookie never reached the browser). Both look
// like "it works" if you only click it once.

test.describe("language", () => {
  test("defaults to English for an en-US browser", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("switching to Lithuanian translates the page and sticks", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: "Lietuvių" }).click();

    await expect(page.getByRole("heading", { name: "Sveiki sugrįžę" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "lt");

    // The part that a single click doesn't prove: reload and the choice
    // must survive, because it was written to a cookie rather than held
    // in component state.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Sveiki sugrįžę" })).toBeVisible();

    // And back again, so the switcher isn't one-way.
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("an Accept-Language of lt is honoured without a cookie", async ({ browser }) => {
    const context = await browser.newContext({ locale: "lt-LT" });
    const page = await context.newPage();

    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "lt");

    await context.close();
  });
});
