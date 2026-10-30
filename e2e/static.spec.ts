// The gallery as a static site (`GALLERY_STATIC=1`): no stream, no header. The charts poll the
// recorded timelines (`/data/{feed}.json`) and dp-swap reads `partials/{depth}{path}`, so every
// request is one a static host can answer.
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test("a chart polls its recorded timeline and moves, with no event stream", async ({ page }) => {
  const polled: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/data/")) polled.push(new URL(r.url()).pathname);
  });
  await page.addInitScript(() => {
    const opened: string[] = [];
    (window as Window & { __sse?: string[] }).__sse = opened;
    const Native = window.EventSource;
    window.EventSource = class extends Native {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init);
        opened.push(String(url));
      }
    };
  });
  await open(page, "/charts/timeseries");
  await expect.poll(() => polled).toContain("/data/ops.json");

  // The first figure, drawn again as frames arrive: one every 2 seconds.
  const figure = page.locator(".example .figure").first();
  const before = await figure.innerHTML();
  await expect.poll(() => figure.innerHTML(), { timeout: 15_000 }).not.toBe(before);
  expect(await page.evaluate(() => (window as Window & { __sse?: string[] }).__sse)).toEqual([]);
});

test("a timeline is 60 frames, 2 seconds apart", async ({ request }) => {
  for (const feed of ["ops", "sales"]) {
    const res = await request.get(`/data/${feed}.json`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { interval: number; frames: unknown[][] };
    expect(body.interval).toBe(2000);
    expect(body.frames).toHaveLength(60);
  }
});

test("partial navigation reads the partial tree, not a header", async ({ page }) => {
  await open(page, "/charts/bar");
  const partial = page.waitForRequest((r) => /\/partials\/\d+\/charts\/line$/.test(new URL(r.url()).pathname));
  await page.locator('.side a[href="/charts/line"]').click();
  const request = await partial;
  expect(request.headers()["dp-partial"]).toBeUndefined();
  await expect(page).toHaveURL(/\/charts\/line$/);
  await expect(page.locator("h1")).toHaveText("Line");
});

test("nothing links to what needs a server", async ({ page }) => {
  for (const path of ["/", "/charts/bar", "/dashboards/ops", "/guide"]) {
    await open(page, path);
    await expect(page.locator('a[href*="js=off"]')).toHaveCount(0);
    // The prose, not the source files the guide shows.
    const prose = await page.evaluate(() => {
      const main = document.querySelector("#app")!.cloneNode(true) as Element;
      main.querySelectorAll("details.code, pre").forEach((el) => el.remove());
      return main.textContent ?? "";
    });
    expect(prose, path).not.toMatch(/\bSSE\b|server-sent/i);
    await expect(page.locator("body")).not.toHaveAttribute("data-swap-ring");
  }
});
