// The library switch in the top bar: the same page in each gallery (vanilla, Rust, React, Next.js).
// The test server does not set `GALLERY_LIBRARIES`, so the links use the default addresses.
import { expect, test, type Page } from "@playwright/test";
import { open } from "./helpers";

const LIBRARIES = [
  ["vanilla", "Vanilla", "http://localhost:3300"],
  ["rsx", "Rust", "http://localhost:3000"],
  ["react", "React", "http://localhost:3310"],
  ["next", "Next.js", "http://localhost:3320"],
] as const;

const links = (page: Page) => page.locator("header.top nav.library-switch a");

async function expectLinks(page: Page, path: string) {
  await expect(links(page)).toHaveCount(LIBRARIES.length);
  for (const [i, [id, label, base]] of LIBRARIES.entries()) {
    const link = links(page).nth(i);
    await expect(link).toHaveAttribute("data-library", id);
    await expect(link).toHaveText(label);
    await expect(link).toHaveAttribute("href", `${base}${path}`);
  }
}

test("the top bar links the same page in each library, Rust is current", async ({ page }) => {
  await open(page, "/charts/bar");
  await expectLinks(page, "/charts/bar");
  await expect(page.locator('nav.library-switch a[aria-current="page"]')).toHaveText("Rust");
});

test("after a partial navigation the links follow the new path", async ({ page }) => {
  await open(page, "/charts/bar");
  await page.evaluate(() => ((window as Window & { __stay?: number }).__stay = 1));
  await page.locator('#side-nav a[href="/charts/line"]').click();
  await expect(page).toHaveURL(/\/charts\/line$/);
  const name = await page.locator('#side-nav a[href="/charts/line"]').textContent();
  await expect(page.locator("h1")).toHaveText(name!.trim());
  expect(await page.evaluate(() => (window as Window & { __stay?: number }).__stay), "full reload").toBe(1);
  await expectLinks(page, "/charts/line");
});
