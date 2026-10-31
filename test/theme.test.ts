// Light and dark: every color is a CSS var whose value is `light-dark(light, dark)`, so a chart
// follows the page's `color-scheme` with no redraw.
import { describe, expect, it } from "vitest";
import { createTheme, darkTheme, getChart, lightTheme, themeToCssVars, type ChartSpec, type Theme } from "../src/index";
import { resolveColor, seqColor, textOn } from "../src/charts/util";
import { sampleRows } from "./parity/sample";
import { cases as bar } from "./parity/bar.cases";
import { cases as distribution } from "./parity/distribution.cases";
import { cases as hierarchy } from "./parity/hierarchy.cases";
import { cases as html } from "./parity/html.cases";
import { cases as radial } from "./parity/radial.cases";
import { cases as xy } from "./parity/xy.cases";

describe("theme vars", () => {
  it("writes light-dark() for a color dark mode changes", () => {
    const vars = themeToCssVars(lightTheme);
    expect(vars["--d3s-bg"]).toBe("light-dark(#ffffff, #111114)");
    expect(vars["--d3s-series-0"]).toBe("light-dark(#4f46e5, #818cf8)");
    expect(vars["--d3s-seq-0"]).toBe("light-dark(#eef2ff, #1e1b4b)");
  });

  it("writes the plain color when the theme has no dark mode, or dark mode keeps it", () => {
    expect(themeToCssVars(darkTheme)["--d3s-bg"]).toBe("#111114");
    const same = createTheme({ dark: { accent: lightTheme.color.accent } });
    expect(themeToCssVars(same)["--d3s-accent"]).toBe(lightTheme.color.accent);
    // A partial dark mode keeps the other dark colors.
    expect(themeToCssVars(same)["--d3s-bg"]).toBe("light-dark(#ffffff, #111114)");
  });

  it("names a fixed series color once, with its dark color", () => {
    const theme: Theme = createTheme({ color: { named: { Churn: "#dc3309" } }, dark: { named: { Churn: "#ff8866" } } });
    const vars = themeToCssVars(theme);
    const name = Object.keys(vars).find((k) => k.startsWith("--d3s-named-"))!;
    expect(vars[name]).toBe("light-dark(#dc3309, #ff8866)");
  });
});

describe("chart colors", () => {
  it("resolve to the light or the dark value of the theme", () => {
    expect(resolveColor(lightTheme, "var(--d3s-series-1)", false)).toBe("#0ea5e9");
    expect(resolveColor(lightTheme, "var(--d3s-series-1)", true)).toBe("#38bdf8");
    expect(resolveColor(lightTheme, "var(--d3s-negative)", true)).toBe("#f87171");
    expect(resolveColor(lightTheme, seqColor(0), true)).toBe("rgb(30, 27, 75)");
  });

  it("a sequential color is a mix rounded to 0.1 %", () => {
    expect(seqColor(1 / 3)).toBe("color-mix(in oklab, var(--d3s-seq-1) 33.3%, var(--d3s-seq-0))");
    expect(seqColor(-1)).toBe("color-mix(in oklab, var(--d3s-seq-1) 0%, var(--d3s-seq-0))");
  });

  it("text on a fill is readable in both modes", () => {
    expect(textOn(lightTheme, "var(--d3s-series-0)")).toBe("light-dark(#fff, #111)");
    expect(textOn(darkTheme, "var(--d3s-series-0)")).toBe("#111");
  });

  // Every parity case: the marks of every chart type.
  const all = { ...bar, ...distribution, ...hierarchy, ...html, ...radial, ...xy } as Record<
    string,
    { spec: ChartSpec; rows?: typeof sampleRows }
  >;

  it("never put a var() in an SVG presentation attribute: browsers ignore it there", () => {
    for (const [name, c] of Object.entries(all)) {
      const el = document.createElement("div");
      const chart = getChart(c.spec.type)(el, c.spec, { theme: { ...lightTheme, motion: 0 } });
      chart.update(c.rows ?? sampleRows);
      for (const e of el.querySelectorAll("svg *")) {
        for (const a of e.getAttributeNames()) {
          if (a === "style") continue;
          expect(e.getAttribute(a), `${name}: <${e.tagName} ${a}>`).not.toMatch(/var\(|light-dark\(|color-mix\(/);
        }
      }
      chart.destroy();
    }
  });

  it("draw a series with its var, so dark mode changes it with no redraw", () => {
    const el = document.createElement("div");
    const chart = getChart("bar")(
      el,
      { type: "bar", x: "region", y: "amount" },
      { theme: { ...lightTheme, motion: 0 } },
    );
    chart.update(sampleRows);
    const rect = el.querySelector<SVGRectElement>(".d3s-plot rect")!;
    expect(rect.style.getPropertyValue("fill")).toMatch(/^var\(--d3s-series-\d+\)$/);
    chart.destroy();
  });
});
