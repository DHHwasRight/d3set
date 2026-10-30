// The Next.js example (examples/next): Server Components draw the charts into the HTML, the
// browser hydrates them and follows the route handler's server-sent events; a static page ships
// no payload; a Client Component draws everything in the browser.
import { expect, test, type Page } from "@playwright/test";

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

test("server-rendered dashboard: charts in the HTML, hydrated in place, then live", async ({ page, request }) => {
  const html = await (await request.get("/server")).text();
  expect(html).toContain("data-d3s-dashboard");
  expect(html).toMatch(/<svg[^>]*viewBox/);

  const errors = watchErrors(page);
  await page.goto("/server");
  const card = page.locator(".d3s-card").nth(2);
  const before = await card.boundingBox();
  // Hydrated: the payload element is consumed.
  await expect(page.locator("[data-d3s-dashboard]")).toHaveCount(0);
  expect(await card.boundingBox()).toEqual(before);
  // Live: the order count grows with the stream.
  const orders = page.locator(".d3s-card").nth(1).locator(".d3s-kpi-value");
  const first = Number((await orders.textContent())!.replace(/\D/g, ""));
  await expect
    .poll(async () => Number((await orders.textContent())!.replace(/\D/g, "")), { timeout: 10_000 })
    .toBeGreaterThan(first);
  expect(errors).toEqual([]);
});

test("static dashboard: the same markup, no payload", async ({ request }) => {
  const html = await (await request.get("/static")).text();
  expect(html).toContain("d3s-card");
  expect(html).not.toContain("d3s-payload");
});

test("client-only dashboard draws in the browser and goes live", async ({ page, request }) => {
  const html = await (await request.get("/client")).text();
  expect(html).not.toContain("d3s-card");
  const errors = watchErrors(page);
  await page.goto("/client");
  await expect(page.locator(".d3s-card")).toHaveCount(5);
  await expect(page.locator(".d3s-status")).toHaveText("Live", { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test("one server-rendered chart hydrates", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/chart");
  await expect(page.locator("[data-d3s-chart]")).toHaveCount(0);
  await expect(page.locator("figure svg rect").first()).toBeVisible();
  expect(errors).toEqual([]);
});
