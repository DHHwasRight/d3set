// Conformity: each framework gallery (galleries/vanilla, react, next) must draw every page of the
// Rust gallery the same way: the same boxes, the same chart marks, the same text. The Rust
// gallery runs with a fixed clock (GALLERY_NOW); the framework galleries draw the pages exported
// from it (galleries/shared/scripts/export.mjs), so both have the same rows.
//
// Run: D3SET_CONFORMITY=1 npx playwright test --project 'conformity-*'
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { diff, landmarks } from "./helpers";

/** The Rust gallery with a fixed clock: the reference. */
export const REFERENCE = `http://127.0.0.1:${process.env.GALLERY_REFERENCE_PORT ?? 3140}`;

const PAGES: string[] = JSON.parse(
  readFileSync(new URL("../galleries/shared/fixtures/pages.json", import.meta.url), "utf8"),
);

interface Measure {
  boxes: Awaited<ReturnType<typeof landmarks>>;
  marks: string[][];
  text: string;
}

/**
 * What a reader sees: boxes, every mark of every chart (rounded to half a pixel), and the text.
 * Not the parts each gallery writes itself (`data-snippet`): its own code and the words about it.
 */
async function measure(page: Page): Promise<Measure> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.querySelectorAll("[data-snippet]").forEach((e) => e.remove()));
  const boxes = await landmarks(page);
  const { marks, text } = await page.evaluate(() => {
    const r = (v: string | null) =>
      v == null ? "" : v.replace(/-?\d+\.?\d*(e-?\d+)?/g, (n) => String(Math.round(Number(n) * 2) / 2));
    const marks = [...document.querySelectorAll(".d3s-chart")].map((chart) =>
      [...chart.querySelectorAll("rect, path, circle, line, text, td, th")]
        .filter((e) => !e.closest(".d3s-brush"))
        .map((e) =>
          [
            e.tagName.toLowerCase(),
            ...["d", "x", "y", "width", "height", "cx", "cy", "r", "x1", "x2", "y1", "y2", "transform"].map((a) =>
              r(e.getAttribute(a)),
            ),
            e.getAttribute("fill") ?? "",
            e.getAttribute("stroke") ?? "",
            ["text", "td", "th"].includes(e.tagName.toLowerCase()) ? (e.textContent ?? "") : "",
          ].join("|"),
        ),
    );
    const main = document.querySelector(".main") as HTMLElement | null;
    return { marks, text: (main?.innerText ?? "").replace(/\s+/g, " ").trim() };
  });
  return { boxes, marks, text };
}

async function reference(page: Page, path: string): Promise<Measure> {
  await page.goto(`${REFERENCE}${path}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => !document.querySelector("[data-d3s-dashboard] .d3s-payload, [data-d3s-chart] .d3s-payload"),
    null,
    { timeout: 15_000 },
  );
  return measure(page);
}

/** A framework gallery sets `data-gallery-ready` on `<html>` once every chart of the page is drawn. */
async function gallery(page: Page, path: string): Promise<Measure> {
  await open(page, path);
  return measure(page);
}

async function open(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.dataset.galleryReady === "true", null, {
    timeout: 15_000,
  });
}

{
  for (const path of PAGES) {
    test(`${path} matches the Rust gallery`, async ({ page }) => {
      // The browser's clock is the gallery's: time windows filter the same rows on both sides.
      await page.clock.setFixedTime(new Date("2026-10-01T00:00:00Z"));
      const ref = await reference(page, path);
      const got = await gallery(page, path);
      expect(diff(ref.boxes, got.boxes), "boxes").toEqual([]);
      expect(got.marks.length, "charts").toBe(ref.marks.length);
      got.marks.forEach((m, i) => expect(m, `chart ${i}`).toEqual(ref.marks[i]));
      expect(got.text, "text").toBe(ref.text);
    });
  }
}

/** The code a gallery shows is the code of its files, as they are now: no copy to go stale. */
for (const path of ["/", "/guide", "/charts/bar", "/dashboards/ops", "/analytics/usage"]) {
  test(`${path} shows this gallery's own code`, async ({ page }) => {
    await open(page, path);
    const parts = page.locator("[data-snippet]");
    expect(await parts.count(), "parts this gallery writes").toBeGreaterThan(0);
    const blocks = await parts.locator("details.code").evaluateAll((all) =>
      all.map((d) => ({
        path: d.querySelector("summary")!.firstChild!.textContent!.trim(),
        code: (d.querySelector("pre") as HTMLElement).innerText,
      })),
    );
    if (["/guide", "/charts/bar"].includes(path)) expect(blocks.length, "code blocks").toBeGreaterThan(0);
    const name = test.info().project.name.replace("conformity-", "");
    for (const block of blocks) {
      expect(block.path, "a file of this gallery").toMatch(new RegExp(`^galleries/${name}/`));
      const file = readFileSync(fileURLToPath(new URL(`../${block.path}`, import.meta.url)), "utf8");
      expect(block.code.trimEnd(), block.path).toBe(file.trimEnd());
    }
    await expect(page.locator("main")).not.toContainText("rsx");
    // A client-side gallery has no server rendering and no server-sent events.
    if (name !== "next") {
      await expect(page.locator("main")).not.toContainText(/\bSSE\b|server-sent|rendered on the server/i);
      expect(await page.title()).not.toMatch(/server/i);
    }
  });
}

/** The library switch: this gallery's item is the current one, each link goes to this page. */
for (const path of ["/", "/charts/bar", "/analytics/usage"]) {
  test(`${path} switches to the same page in each library`, async ({ page }) => {
    await open(page, path);
    const name = test.info().project.name.replace("conformity-", "");
    const links = page.locator("nav.library-switch a");
    expect(await links.evaluateAll((all) => all.map((a) => a.getAttribute("data-library")))).toEqual([
      "vanilla",
      "rsx",
      "react",
      "next",
    ]);
    await expect(page.locator("nav.library-switch a[aria-current=page]")).toHaveAttribute("data-library", name);
    for (const href of await links.evaluateAll((all) => all.map((a) => (a as HTMLAnchorElement).href))) {
      expect(new URL(href).pathname, href).toBe(path);
    }
  });
}
