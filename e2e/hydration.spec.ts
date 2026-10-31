// Hydration replaces server markup with live charts that draw the same marks.
import { expect, test, type Page } from "@playwright/test";
import { KINDS } from "./helpers";

function snapshot(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".figure figure")].map((f) => {
      const r = (v: string | null) =>
        v == null ? "" : v.replace(/-?\d+\.?\d*/g, (n) => String(Math.round(Number(n) * 2) / 2));
      const marks = [...f.querySelectorAll("svg rect, svg path, svg circle, svg text")]
        .filter((e) => !e.closest(".d3s-brush") && !e.classList.contains("d3s-rule") && !e.closest(".tick"))
        .map((e) =>
          [
            e.tagName,
            r(e.getAttribute("d")),
            r(e.getAttribute("x")),
            r(e.getAttribute("y")),
            r(e.getAttribute("width")),
            r(e.getAttribute("height")),
            // The color as drawn: charts write colors as `style` (theme variables), and an
            // attribute or a style with the same value must compare equal.
            getComputedStyle(e).fill,
            e.tagName === "text" ? e.textContent : "",
          ].join("|"),
        );
      const chart = f.querySelector(".d3s-chart, .d3s-note")!;
      const box = chart.getBoundingClientRect();
      return {
        marks,
        ticks: [...f.querySelectorAll(".tick text")].map((t) => t.textContent),
        text: chart.querySelector("svg") ? "" : chart.textContent!.replace(/\s+/g, " ").trim(),
        size: `${Math.round(box.width)}x${Math.round(box.height)}`,
      };
    }),
  );
}

test("every chart page draws the same before and after hydration", async ({ browser, request }) => {
  test.setTimeout(180_000);
  for (const kind of KINDS) {
    const url = `/charts/${kind}`;
    // One response, served to both pages: the live feed must not change the data between them.
    const html = await (await request.get(url)).text();
    const render = async (hydrate: boolean) => {
      const page = await browser.newPage();
      await page.route(`**${url}`, (r) => r.fulfill({ body: html, contentType: "text/html; charset=utf-8" }));
      // The stream would add rows after hydration: block it.
      await page.route("**/events/**", (r) => r.abort());
      // Server markup only: the boot module never runs.
      if (!hydrate) await page.route("**/js/gallery*", (r) => r.abort());
      await page.goto(url, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      if (hydrate) await page.waitForFunction(() => !document.querySelector("[data-d3s-chart] .d3s-payload"));
      const out = await snapshot(page);
      await page.close();
      return out;
    };
    expect(await render(true), kind).toEqual(await render(false));
  }
});
