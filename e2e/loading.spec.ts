// Nothing moves while a page loads: no layout shift when fonts arrive or when charts hydrate.
import { expect, test, type Page } from "@playwright/test";
import { PAGES } from "./helpers";

async function shifts(page: Page, url: string, fontDelay = 0) {
  if (fontDelay)
    await page.route("**/*.woff2", async (route) => {
      await new Promise((r) => setTimeout(r, fontDelay));
      await route.continue();
    });
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>)
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(fontDelay + 800);
  return page.evaluate(() => (window as unknown as { __cls: number }).__cls);
}

for (const path of PAGES) {
  test(`${path} loads without layout shift`, async ({ page }) => {
    expect(await shifts(page, path)).toBeLessThan(0.001);
  });
}

test("with fonts 1.5 s late, the metric-matched fallback keeps shifts negligible", async ({ page }) => {
  for (const path of ["/charts/bar", "/dashboards/sales", "/guide"]) {
    expect(await shifts(page, path, 1500), path).toBeLessThan(0.002);
  }
});
