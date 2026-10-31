// Light and dark: `color-scheme` on <html> picks every `light-dark()` color, the charts' too. The
// page follows the system until the theme switch stores a choice; a head script applies a stored
// choice before the first paint.
import { expect, test, type Page } from "@playwright/test";
import { open } from "./helpers";

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const LIGHT = "rgb(255, 255, 255)";

test("follows the system until a choice is stored", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page, "/charts/bar");
  expect(await background(page)).not.toBe(LIGHT);
  await expect(page.locator("#theme-switch")).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ colorScheme: "light" });
  expect(await background(page)).toBe(LIGHT);
  await expect(page.locator("#theme-switch")).toHaveAttribute("aria-pressed", "false");
});

test("the switch changes the theme, and the choice survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page, "/charts/bar");
  const button = page.locator("#theme-switch");
  const box = await button.boundingBox();
  await button.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await background(page)).not.toBe(LIGHT);
  // Same box in both states: nothing in the top bar moves.
  expect(await button.boundingBox()).toEqual(box);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(button).toHaveAttribute("aria-pressed", "true");

  await button.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await background(page)).toBe(LIGHT);
});

test("a stored dark choice is applied before any module runs: no flash", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("d3set-theme", "dark"));
  // Without the gallery's module, only the head script can set the theme.
  await page.route(/\/js\/gallery[^/]*\.js$/, (route) => route.abort());
  await page.goto("/charts/bar", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).not.toBe(LIGHT);
});

test("a chart changes colors with the theme without a redraw", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page, "/charts/bar");
  const mark = page.locator(".d3s-chart svg rect[style*='var(--d3s-series']").first();
  const element = await mark.elementHandle();
  const fill = () => element!.evaluate((e) => getComputedStyle(e).fill);
  const before = await fill();
  await page.locator("#theme-switch").click();
  await expect.poll(fill).not.toBe(before);
  // The same element: the colors changed through CSS, not a new drawing.
  expect(await element!.evaluate((e) => e.isConnected)).toBe(true);
});

test("the switch keeps working after a partial navigation", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page, "/charts/bar");
  await page.locator('.side a[href="/charts/line"]').click();
  await expect(page).toHaveURL(/\/charts\/line$/);
  await page.locator("#theme-switch").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
