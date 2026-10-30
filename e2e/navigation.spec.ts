// Partial navigation with dp-swap: a click swaps only the layers that change, the out-of-band
// chrome follows, the new charts hydrate and go live, and the old streams close.
import { expect, test, type Page, type Request } from "@playwright/test";
import { open } from "./helpers";

type Win = Window & {
  __stay?: number;
  __tag?: number;
  __rings?: string[];
  __peak?: number;
  d3set?: { hydrated(): unknown; streams(): unknown };
};

const PAYLOAD = "[data-d3s-chart] script.d3s-payload, [data-d3s-dashboard] script.d3s-payload";

const streams = (page: Page) =>
  page.evaluate(() => {
    const v = (window as Win).d3set?.streams();
    return Array.isArray(v) ? v.length : v instanceof Set || v instanceof Map ? v.size : Number(v ?? 0);
  });

const hydrated = (page: Page) =>
  page.evaluate(() => {
    const v = (window as Win).d3set?.hydrated();
    return Array.isArray(v) ? v.length : v instanceof Set || v instanceof Map ? v.size : Number(v ?? 0);
  });

/** Collect page errors and console errors. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("favicon") && errors.push(m.text()));
  return errors;
}

/** dp-swap sends `DP-Partial: true` for one kept layer and the number for more. */
const depth = (h: string | undefined) => (h === "true" ? "1" : h);

/** Record the `DP-Partial` header of every request to `path`. */
function watchPartials(page: Page, path: string): (string | undefined)[] {
  const seen: (string | undefined)[] = [];
  const on = (r: Request) => {
    if (new URL(r.url()).pathname === path && ["fetch", "xhr", "document"].includes(r.resourceType()))
      seen.push(depth(r.headers()["dp-partial"]));
  };
  page.on("request", on);
  return seen;
}

/** Wait until the page shows `path`, its `h1` differs from `before`, and no chart waits for hydration. */
async function settle(page: Page, path: string, before?: string) {
  await page.waitForFunction(
    ([p, h, sel]) =>
      location.pathname === p &&
      (h == null || document.querySelector("h1")?.textContent !== h) &&
      !document.querySelector(sel!),
    [path, before ?? null, PAYLOAD] as const,
    { timeout: 10_000 },
  );
}

/** Click the sidebar link to `path` and wait for the swap. Returns the `DP-Partial` headers sent. */
async function go(page: Page, path: string) {
  const partials = watchPartials(page, path);
  const before = await page.locator("h1").first().textContent();
  const response = page.waitForResponse((r) => new URL(r.url()).pathname === path, { timeout: 15_000 });
  await page.locator(`#side-nav a[href="${path}"]`).click();
  await response;
  await settle(page, path, before ?? undefined);
  return partials;
}

async function start(page: Page, path: string) {
  await open(page, path);
  await page.evaluate(() => ((window as Win).__stay = 1));
}

const stay = (page: Page) => page.evaluate(() => (window as Win).__stay);

/** Record every element that gets the class `is-swapped`. */
async function watchRings(page: Page) {
  await page.evaluate(() => {
    const w = window as Win;
    w.__rings = [];
    const note = (el: Element) => w.__rings!.push(el.id || el.className);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "attributes" && (m.target as Element).classList.contains("is-swapped"))
          note(m.target as Element);
        for (const n of m.addedNodes)
          if (n instanceof Element)
            (n.querySelectorAll(".is-swapped").forEach(note), n.matches(".is-swapped") && note(n));
      }
    }).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  });
}

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = watchErrors(page);
});
test.afterEach(() => {
  expect(errors, "console errors").toEqual([]);
});

test("a sidebar link to another chart page swaps the page without a full reload", async ({ page }) => {
  await start(page, "/charts/bar");
  const name = await page.locator('#side-nav a[href="/charts/line"]').textContent();
  const partials = await go(page, "/charts/line");

  expect(await stay(page), "full reload").toBe(1);
  expect(partials.length).toBeGreaterThan(0);
  expect(
    partials.every((p) => p != null),
    `DP-Partial headers: ${partials}`,
  ).toBe(true);
  expect(new URL(page.url()).pathname).toBe("/charts/line");
  await expect(page.locator("h1")).toHaveText(name!.trim());
  await expect(page.locator("#side-nav .side-link.is-current")).toHaveCount(1);
  await expect(page.locator("#side-nav .side-link.is-current")).toHaveAttribute("href", "/charts/line");
  await expect(page.locator("#top-nav .is-current")).toHaveCount(1);
  await expect(page.locator("#top-nav .is-current")).toHaveText("Charts");
  // A hydrated chart loses its `data-d3s-chart` attribute: look for the drawn chart.
  await expect(page.locator(".figure .d3s-chart svg").first()).toBeVisible();
  await expect(page.locator(PAYLOAD)).toHaveCount(0);
  expect(await hydrated(page)).toBeGreaterThan(0);
});

test("inside a section only the section region is swapped", async ({ page }) => {
  await start(page, "/charts/bar");
  await page.evaluate(() => {
    (document.querySelector("#app") as unknown as Win).__tag = 1;
    (document.querySelector("#app > .section") as unknown as Win).__tag = 2;
  });
  const partials = await go(page, "/charts/line");

  expect(partials).toEqual(["2"]);
  expect(await page.evaluate(() => (document.querySelector("#app") as unknown as Win).__tag)).toBe(1);
  expect(await page.evaluate(() => (document.querySelector("#app > .section") as unknown as Win).__tag)).toBe(2);
});

test("across sections the whole outlet is swapped and the dashboard goes live", async ({ page }) => {
  await start(page, "/charts/bar");
  const partials = await go(page, "/dashboards/sales");

  expect(partials).toEqual(["1"]);
  expect(await stay(page), "full reload").toBe(1);
  await expect(page.locator(".d3s-root svg").first()).toBeVisible();
  expect(await hydrated(page)).toBeGreaterThan(0);
  await expect(page.locator(PAYLOAD)).toHaveCount(0);
  await expect(page.locator("#top-nav .is-current")).toHaveText("Dashboards");
  await expect.poll(() => streams(page)).toBeGreaterThan(0);
});

test("leaving a live page closes its streams", async ({ page, context }) => {
  const tour = ["/charts/line", "/charts/area", "/charts/timeseries", "/dashboards/sales", "/charts/bar"];

  // What each page needs: its stream count right after a fresh full load.
  const need: Record<string, number> = {};
  const fresh = await context.newPage();
  for (const path of tour) {
    await open(fresh, path);
    await fresh.waitForTimeout(500);
    need[path] = await streams(fresh);
  }
  await fresh.close();
  expect(Math.max(...Object.values(need)), "the tour has live pages").toBeGreaterThan(0);

  await start(page, "/charts/bar");
  await page.evaluate(() => {
    const w = window as Win;
    w.__peak = 0;
    setInterval(() => {
      const v = w.d3set?.streams();
      const n = Array.isArray(v) ? v.length : v instanceof Set || v instanceof Map ? v.size : Number(v ?? 0);
      w.__peak = Math.max(w.__peak ?? 0, n);
    }, 10);
  });
  for (const path of tour) {
    await go(page, path);
    await expect.poll(() => streams(page), path).toBe(need[path]);
  }
  const peak = await page.evaluate(() => (window as Win).__peak);
  expect(peak, "streams open at once").toBeLessThanOrEqual(Math.max(...Object.values(need)));
  expect(await stay(page), "full reload").toBe(1);
});

test("back and forward show the previous pages hydrated with the right current link", async ({ page }) => {
  await start(page, "/charts/bar");
  await go(page, "/charts/line");
  await go(page, "/charts/area");

  const check = async (path: string) => {
    await settle(page, path);
    await expect(page.locator("#side-nav .side-link.is-current")).toHaveAttribute("href", path);
    const name = await page.locator(`#side-nav a[href="${path}"]`).textContent();
    await expect(page.locator("h1")).toHaveText(name!.trim());
    await expect(page.locator(PAYLOAD)).toHaveCount(0);
    expect(await hydrated(page)).toBeGreaterThan(0);
  };
  await page.goBack({ waitUntil: "commit" });
  await check("/charts/line");
  await page.goBack({ waitUntil: "commit" });
  await check("/charts/bar");
  await page.goForward({ waitUntil: "commit" });
  await check("/charts/line");
});

test("the no-JavaScript link reloads the whole page without scripts or hydration", async ({ page }) => {
  await start(page, "/charts/line");
  const partials = watchPartials(page, "/charts/line");
  await page.locator('a[href$="?js=off"]').first().click();
  await page.waitForURL((u) => u.searchParams.get("js") === "off");
  await page.waitForLoadState("load");

  expect(await stay(page), "the page reloaded").toBeUndefined();
  expect(
    partials.every((p) => p == null),
    `DP-Partial headers: ${partials}`,
  ).toBe(true);
  await expect(page.locator("script")).toHaveCount(0);
  expect(await page.evaluate(() => typeof (window as Win).d3set)).toBe("undefined");
  await expect(page.locator(".d3s-chart svg").first()).toBeVisible();
});

test("a tour of the gallery by partial navigation logs no console errors", async ({ page }) => {
  await start(page, "/");
  for (const path of ["/guide", "/charts/bar", "/charts/kpi", "/charts/table", "/dashboards/ops", "/charts/line", "/"])
    await go(page, path);
  expect(await stay(page), "full reload").toBe(1);
  expect(errors).toEqual([]);
});

test("without the swap ring setting no element is ever marked as swapped", async ({ page }) => {
  await start(page, "/charts/bar");
  await expect(page.locator("body")).not.toHaveAttribute("data-swap-ring", /.*/);
  await watchRings(page);
  await go(page, "/charts/line");
  await go(page, "/dashboards/sales");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as Win).__rings)).toEqual([]);
  await expect(page.locator(".is-swapped")).toHaveCount(0);
});

test(
  "with the swap ring setting the swapped element is marked, then unmarked after the animation",
  { tag: "@ring" },
  async ({ page }) => {
    await start(page, "/charts/bar");
    await expect(page.locator("body")).toHaveAttribute("data-swap-ring", /.*/);
    await watchRings(page);
    await go(page, "/charts/line");
    await expect.poll(() => page.evaluate(() => (window as Win).__rings!.length)).toBeGreaterThan(0);
    await expect(page.locator(".is-swapped")).toHaveCount(0, { timeout: 3_000 });
  },
);
