// The Analytics page: tabs and views of a billing dashboard, each a d3set dashboard drawn on the
// server and hydrated, with partial navigation between tabs.
import { expect, test, type Page } from "@playwright/test";
import { ANALYTICS } from "./helpers";

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("favicon") && errors.push(m.text()));
  return errors;
}

const hydrated = (page: Page) =>
  page.waitForFunction(() => !document.querySelector("[data-d3s-dashboard] script.d3s-payload"), null, {
    timeout: 15_000,
  });

/** Every card's box: hydration must not move or resize one. */
const boxes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".tab-panel .d3s-card")].map((c) => {
      const r = c.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(",");
    }),
  );

test("the 6 tabs and 10 views of the dashboard", () => {
  expect(ANALYTICS.map(([tab]) => tab)).toEqual([
    "Subscriptions",
    "Revenue",
    "Credit ledgers",
    "Usage",
    "Cash collection",
    "Invoices",
  ]);
  expect(ANALYTICS.flatMap(([, v]) => v)).toHaveLength(10);
});

for (const [tab, views] of ANALYTICS) {
  for (const [id, name, charts] of views) {
    test(`${tab} › ${name}: server-rendered, hydrated in place, no errors`, async ({ page, browser }) => {
      const errors = watchErrors(page);
      const url = `/analytics/${id}`;

      // The markup without the script: every chart is already there.
      const bare = await browser.newPage();
      await bare.route("**/js/gallery*", (r) => r.abort());
      await bare.goto(url, { waitUntil: "load" });
      await bare.evaluate(() => document.fonts.ready);
      await expect(bare.locator(".tab-panel .d3s-card")).toHaveCount(charts);
      const before = await boxes(bare);
      await bare.close();

      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      await hydrated(page);
      await expect(page.locator(".tab-panel .d3s-card")).toHaveCount(charts);
      expect(await boxes(page)).toEqual(before);

      await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
      if (views.length > 1)
        await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
      else await expect(page.locator(".tabs-pills")).toHaveCount(0);
      // Each section draws marks, lines of a table, or a big number.
      for (const card of await page.locator(".tab-panel .d3s-card").all())
        await expect(card.locator("svg rect, svg path, tbody tr, .d3s-kpi-value").first()).toBeAttached();
      expect(errors).toEqual([]);
    });
  }
}

test("a tab click swaps the view without a page load", async ({ page }) => {
  await page.goto("/analytics");
  await hydrated(page);
  await page.evaluate(() => ((window as Window & { __stay?: number }).__stay = 1));

  await page.getByRole("tab", { name: "Revenue", exact: true }).click();
  await expect(page).toHaveURL(/\/analytics\/revenue-streams$/);
  await expect(page.getByRole("tab", { name: "Revenue streams" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "MRR", exact: true }).click();
  await expect(page).toHaveURL(/\/analytics\/revenue-mrr$/);
  await hydrated(page);
  await expect(page.locator(".tab-panel h3", { hasText: "MRR breakout" })).toBeVisible();
  // Same document: the marker set before the clicks is still there.
  expect(await page.evaluate(() => (window as Window & { __stay?: number }).__stay)).toBe(1);
});

test("the sidebar links Analytics", async ({ page }) => {
  await page.goto("/charts/bar");
  await expect(page.locator('.side a[href="/analytics"]')).toBeVisible();
});
