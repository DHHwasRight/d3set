// Charts use d3set's palette.
import { expect, test, type Locator } from "@playwright/test";
import { open } from "./helpers";

const ORIGINAL = ["#635BFF", "#00A8E8", "#0E8A5F", "#F5A524", "#DF1B41", "#A960EE", "#0A2540"];
const hex = (rgb: string) => {
  const m = rgb.match(/\d+/g);
  return m
    ? "#" +
        m
          .slice(0, 3)
          .map((n) => Number(n).toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase()
    : rgb.toUpperCase();
};

/** The legend swatch colors of the charts inside `scope`. */
async function swatches(scope: Locator): Promise<string[]> {
  const raw = await scope
    .locator(".d3s-legend-item i")
    .evaluateAll((is) => is.map((i) => getComputedStyle(i).backgroundColor));
  return [...new Set(raw.map(hex))];
}

test("charts use d3set's palette", async ({ page }) => {
  await open(page, "/charts/bar");
  const colors = await swatches(page.locator(".figure"));
  expect(colors.length).toBeGreaterThan(2);
  expect(colors.filter((c) => !ORIGINAL.includes(c))).toEqual([]);
});
