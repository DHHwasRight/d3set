// The GitHub Pages build: the four galleries under /d3set/, served as files (`D3SET_PAGES=1`).
// Every request is one a static host answers: documents, dp-swap partials by depth, JSON timelines.
import { expect, test, type Page } from "@playwright/test";

const LIBRARIES = [
  { id: "rsx", prefix: "/d3set" },
  { id: "vanilla", prefix: "/d3set/vanilla" },
  { id: "react", prefix: "/d3set/react" },
  { id: "next", prefix: "/d3set/next" },
];

function requests(page: Page, part: string): string[] {
  const seen: string[] = [];
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (path.includes(part)) seen.push(path);
  });
  return seen;
}

test("every Rust chart embeds its rows, and the timeline continues them", async ({ request }) => {
  const html = await (await request.get("/d3set/charts/timeseries/")).text();
  const payloads = [...html.matchAll(/class="d3s-payload">(.*?)<\/script>/gs)].map(
    (m) => JSON.parse(m[1]) as { rows: { id: number; at: string }[]; stream?: { url: string } },
  );
  expect(payloads.length).toBeGreaterThan(0);
  for (const p of payloads) expect(p.rows.length).toBeGreaterThan(100);
  const ops = payloads.find((p) => p.stream?.url.endsWith("/data/ops.json"))!;
  const timeline = (await (await request.get("/d3set/data/ops.json")).json()) as {
    frames: { id: number; at: string }[][];
  };
  const first = timeline.frames.find((f) => f.length > 0)![0];
  // The first frame comes right after the newest embedded row: no gap on the time axis.
  expect(first.id).toBe(Math.max(...ops.rows.map((r) => r.id)) + 1);
  expect(Date.parse(first.at)).toBeGreaterThanOrEqual(Math.max(...ops.rows.map((r) => Date.parse(r.at))));
});

test("the Rust gallery navigates with partials from the partial directory", async ({ page }) => {
  const partials = requests(page, "/partials/");
  await page.goto("/d3set/charts/bar/");
  await page.evaluate(() => ((window as Window & { __stay?: number }).__stay = 1));
  await page.locator('.side a[href="/d3set/charts/line"]').click();
  await expect(page).toHaveURL(/\/d3set\/charts\/line$/);
  await expect(page.locator("main h1")).toHaveText("Line");
  expect(partials.some((p) => /^\/d3set\/partials\/\d\/charts\/line\/?$/.test(p))).toBe(true);
  // Same document: the marker survived the navigation.
  expect(await page.evaluate(() => (window as Window & { __stay?: number }).__stay)).toBe(1);
});

for (const { id, prefix } of LIBRARIES) {
  test(`${id}: a direct load draws a chart that polls its timeline`, async ({ page }) => {
    const polled = requests(page, "/d3set/data/");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(`${prefix}/charts/timeseries/`);
    expect(res?.status()).toBe(200);
    await expect(page.locator("svg").first()).toBeVisible();
    await expect.poll(() => polled.length, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test(`${id}: the dashboard counts its recorded rows in the time window`, async ({ page }) => {
    await page.goto(`${prefix}/dashboards/ops/`);
    const requests = page.locator(".d3s-card", { hasText: "Requests" }).first().locator(".d3s-kpi-value");
    // After hydration too: the window counts from when the rows were drawn, not from today.
    await page.waitForTimeout(2500);
    await expect.poll(async () => Number((await requests.textContent())!.replace(/\D/g, ""))).toBeGreaterThan(0);
  });

  test(`${id}: the library switch marks it and keeps the page`, async ({ page }) => {
    await page.goto(`${prefix}/charts/bar/`);
    await expect(page.locator(`nav.library-switch a[aria-current="page"]`)).toHaveAttribute("data-library", id);
    for (const other of LIBRARIES.filter((l) => l.id !== id)) {
      const href = await page.locator(`nav.library-switch a[data-library="${other.id}"]`).getAttribute("href");
      expect(new URL(href!, page.url()).pathname.replace(/\/$/, "")).toBe(`${other.prefix}/charts/bar`);
    }
  });
}

test("the switch follows a navigation and opens the same page in the other gallery", async ({ page }) => {
  await page.goto("/d3set/charts/bar/");
  await page.locator('.side a[href="/d3set/charts/line"]').click();
  await expect(page).toHaveURL(/\/d3set\/charts\/line$/);
  await page.locator('nav.library-switch a[data-library="vanilla"]').click();
  await expect(page).toHaveURL(/\/d3set\/vanilla\/charts\/line\/?$/);
  await expect(page.locator(`nav.library-switch a[aria-current="page"]`)).toHaveAttribute("data-library", "vanilla");
});

test("an unknown path answers the 404 page", async ({ page }) => {
  const res = await page.goto("/d3set/no-such-page/");
  expect(res?.status()).toBe(404);
});
