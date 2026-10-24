import { describe, expect, it } from "vitest";
import { builtInCharts, getChart, lightTheme, type ChartSpec } from "../src/index";
import { toBars } from "../src/charts/bar";
import { topN } from "../src/charts/util";

const rows = Array.from({ length: 40 }, (_, i) => ({
  at: `2026-01-01T10:${String(i % 60).padStart(2, "0")}:00Z`,
  region: ["EU", "US", "APAC"][i % 3]!,
  product: ["Starter", "Pro", "Enterprise"][i % 3 === 0 ? 0 : i % 2]!,
  amount: 10 + ((i * 37) % 90),
  seats: 1 + (i % 7),
}));

const specs: Record<keyof typeof builtInCharts, ChartSpec> = {
  line: { type: "line", x: "at", y: "amount", series: "region", aggregate: "sum" },
  area: { type: "area", x: "at", y: "amount", series: "region", aggregate: "sum" },
  bar: { type: "bar", x: "product", y: "amount", series: "region", stacked: true, horizontal: true },
  pie: { type: "pie", x: "region", y: "amount" },
  donut: { type: "donut", x: "region", y: "amount" },
  scatter: { type: "scatter", x: "seats", y: "amount", size: "seats", series: "region" },
  heatmap: { type: "heatmap", x: "product", series: "region", y: "amount" },
  histogram: { type: "histogram", y: "amount", bins: 10 },
  boxplot: { type: "boxplot", x: "region", y: "amount" },
  treemap: { type: "treemap", x: "product", series: "region", y: "amount" },
  funnel: { type: "funnel", x: "product", y: "amount" },
  gauge: { type: "gauge", y: "amount", aggregate: "avg", max: 100 },
  kpi: { type: "kpi", x: "at", y: "amount" },
  table: { type: "table", columns: [{ field: "region" }, { field: "amount", format: ",.0f" }] },
};

describe("built-in charts", () => {
  for (const [type, spec] of Object.entries(specs)) {
    it(`${type} renders, updates, changes theme, and cleans up`, () => {
      const parent = document.createElement("div");
      const el = document.createElement("div");
      parent.append(el);
      const chart = getChart(type)(el, spec, { theme: lightTheme });
      chart.update([]);
      chart.update(rows);
      chart.update(rows.slice(5));
      chart.setTheme({ ...lightTheme, motion: 0 });
      expect(el.querySelector("svg, table")).not.toBeNull();
      chart.destroy();
      expect(parent.querySelector(".d3s-legend")).toBeNull();
    });
  }

  it("fails with a clear message when a field is missing", () => {
    expect(() => getChart("bar")(document.createElement("div"), { type: "bar", y: "amount" }, { theme: lightTheme })).toThrow(
      "chart type 'bar' requires field 'x'",
    );
  });
});

describe("bar data", () => {
  it("stacks series per category", () => {
    const data = toBars(
      [
        { c: "a", s: "x", v: 1 },
        { c: "a", s: "y", v: 2 },
        { c: "b", s: "x", v: 4 },
      ],
      { type: "bar", x: "c", y: "v", series: "s", stacked: true },
      "c",
      "v",
    );
    const ay = data.bars.find((b) => b.category === "a" && b.series === "y")!;
    expect([ay.v0, ay.v1]).toEqual([1, 3]);
  });

  it("groups small categories into Other", () => {
    expect(topN([["a", 5], ["b", 1], ["c", 9], ["d", 2]], 3)).toEqual([["c", 9], ["a", 5], ["Other", 3]]);
  });
});

describe("table", () => {
  it("aggregates in group mode and sorts on header click", () => {
    const el = document.createElement("div");
    const chart = getChart("table")(el, { type: "table", x: "region", y: "amount", aggregate: "sum" }, { theme: lightTheme });
    chart.update([
      { region: "EU", amount: 5 },
      { region: "US", amount: 20 },
      { region: "EU", amount: 10 },
    ]);
    const cells = () => [...el.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((td) => td.textContent));
    expect(cells()).toEqual([["EU", "15"], ["US", "20"]]);
    el.querySelectorAll("th")[1]!.dispatchEvent(new MouseEvent("click"));
    expect(cells()[0]).toEqual(["US", "20"]);
    expect(el.querySelectorAll("th")[1]!.getAttribute("aria-sort")).toBe("descending");
  });
});
