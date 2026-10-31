import { describe, expect, it } from "vitest";
import { builtInCharts, getChart, lightTheme, type ChartSpec } from "../src/index";
import { toBars } from "../src/charts/bar";
import { bandLabelEvery, matchThreshold, parseInterval, resolveColor, stableColors, topN } from "../src/charts/util";
import { namedVar, themeToCssVars } from "../src/theme/theme";
import { toSeriesData } from "../src/charts/xy";

const rows = Array.from({ length: 40 }, (_, i) => ({
  at: `2026-01-01T10:${String(i % 60).padStart(2, "0")}:00Z`,
  region: ["EU", "US", "APAC"][i % 3]!,
  product: ["Starter", "Pro", "Enterprise"][i % 3 === 0 ? 0 : i % 2]!,
  amount: 10 + ((i * 37) % 90),
  seats: 1 + (i % 7),
  host: `host-${i % 6}`,
  level: ["info", "warn", "error"][i % 3]!,
  check: ["ok", "ok", "warning", "critical"][i % 4]!,
  latency: 50 + ((i * 53) % 400),
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
  timeseries: {
    type: "timeseries",
    x: "at",
    y: "amount",
    series: "region",
    display: "bars",
    thresholds: [{ op: ">", value: 100 }],
  },
  toplist: {
    type: "toplist",
    x: "host",
    y: "latency",
    aggregate: "avg",
    thresholds: [{ op: ">", value: 200, level: "warning" }],
  },
  change: { type: "change", x: "at", y: "amount", series: "region", window: "10m" },
  timeheatmap: { type: "timeheatmap", x: "at", y: "latency", interval: "5m", bins: 8 },
  hostmap: { type: "hostmap", x: "host", y: "latency", series: "region" },
  status: { type: "status", x: "host", y: "check", series: "at" },
  stream: { type: "stream", x: "at", y: "customer", series: "level", columns: [{ field: "host" }] },
  sunburst: { type: "sunburst", x: "product", series: "region", y: "amount" },
  slo: { type: "slo", y: "latency", objective: { good: { op: "<=", value: 300 }, target: 99 } },
  note: { type: "note", text: "Hello.\n\nSecond paragraph." },
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
      expect(el.childElementCount).toBeGreaterThan(0);
      chart.destroy();
      expect(parent.querySelector(".d3s-legend")).toBeNull();
    });
  }

  it("fails with a clear message when a field is missing", () => {
    expect(() =>
      getChart("bar")(document.createElement("div"), { type: "bar", y: "amount" }, { theme: lightTheme }),
    ).toThrow("chart type 'bar' requires field 'x'");
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
    expect(
      topN(
        [
          ["a", 5],
          ["b", 1],
          ["c", 9],
          ["d", 2],
        ],
        3,
      ),
    ).toEqual([
      ["c", 9],
      ["a", 5],
      ["Other", 3],
    ]);
  });
});

describe("table", () => {
  it("aggregates in group mode and sorts on header click", () => {
    const el = document.createElement("div");
    const chart = getChart("table")(
      el,
      { type: "table", x: "region", y: "amount", aggregate: "sum" },
      { theme: lightTheme },
    );
    chart.update([
      { region: "EU", amount: 5 },
      { region: "US", amount: 20 },
      { region: "EU", amount: 10 },
    ]);
    const cells = () => [...el.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((td) => td.textContent));
    expect(cells()).toEqual([
      ["EU", "15"],
      ["US", "20"],
    ]);
    el.querySelectorAll("th")[1]!.dispatchEvent(new MouseEvent("click"));
    expect(cells()[0]).toEqual(["US", "20"]);
    expect(el.querySelectorAll("th")[1]!.getAttribute("aria-sort")).toBe("descending");
  });
});

describe("intervals and thresholds", () => {
  it("parses intervals", () => {
    expect(parseInterval("30s")).toBe(30_000);
    expect(parseInterval("5m")).toBe(300_000);
    expect(() => parseInterval("5 minutes")).toThrow("invalid interval '5 minutes'");
  });

  it("buckets dates by interval", () => {
    const data = toSeriesData(
      [
        { t: "2026-01-01T10:00:10Z", v: 1 },
        { t: "2026-01-01T10:04:50Z", v: 2 },
        { t: "2026-01-01T10:05:00Z", v: 4 },
      ],
      { type: "timeseries", interval: "5m", aggregate: "sum" },
      "t",
      "v",
    );
    expect([...data.table.values()].map((m) => m.get("v"))).toEqual([3, 4]);
  });

  it("uses the first matching rule", () => {
    const rules = [
      { op: ">" as const, value: 400, level: "critical" as const },
      { op: ">" as const, value: 200, level: "warning" as const },
    ];
    expect(matchThreshold(450, rules)?.level).toBe("critical");
    expect(matchThreshold(250, rules)?.level).toBe("warning");
    expect(matchThreshold(10, rules)).toBeUndefined();
  });
});

describe("datadog views", () => {
  const render = (spec: ChartSpec, data: Record<string, unknown>[]) => {
    const el = document.createElement("div");
    getChart(spec.type)(el, spec, { theme: lightTheme }).update(data);
    return el;
  };

  it("change compares the last window with the one before", () => {
    const el = render({ type: "change", x: "t", y: "v", series: "g", window: "1m" }, [
      { t: "2026-01-01T10:00:30Z", g: "a", v: 10 },
      { t: "2026-01-01T10:01:30Z", g: "a", v: 15 },
    ]);
    const row = el.querySelector(".d3s-change-row")!;
    expect(row.querySelector(".d3s-change-now")!.textContent).toBe("15");
    expect(row.querySelector(".d3s-change-delta")!.textContent).toBe("▲ 5 (+50.0%)");
  });

  it("status shows the latest state per entity, worst first", () => {
    const el = render({ type: "status", x: "host", y: "state" }, [
      { host: "b", state: "critical" },
      { host: "a", state: "ok" },
      { host: "b", state: "warning" },
    ]);
    const tiles = [...el.querySelectorAll<HTMLElement>(".d3s-status-tile")].map((t) => `${t.title}`);
    expect(tiles).toEqual(["b: warning", "a: ok"]);
  });

  it("slo computes the good share and the error budget", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ latency: i < 99 ? 100 : 900 }));
    const el = render({ type: "slo", y: "latency", objective: { good: { op: "<=", value: 300 }, target: 98 } }, rows);
    expect(el.querySelector(".d3s-kpi-value")!.textContent).toBe("99%");
    expect(el.querySelector(".d3s-slo-meta")!.textContent).toBe("Target 98% · Error budget left 50%");
  });

  it("stream lists the newest rows first", () => {
    const el = render({ type: "stream", x: "t", y: "msg", limit: 2 }, [
      { msg: "one" },
      { msg: "two" },
      { msg: "three" },
    ]);
    expect([...el.querySelectorAll(".d3s-stream-msg")].map((m) => m.textContent)).toEqual(["three", "two"]);
  });
});

describe("live updates", () => {
  it("draws at once when motion is 0, so fast updates cannot cancel the drawing", () => {
    const el = document.createElement("div");
    const chart = getChart("timeseries")(
      el,
      { type: "timeseries", x: "at", y: "amount", series: "region" },
      { theme: { ...lightTheme, motion: 0 } },
    );
    chart.update(rows);
    chart.update(rows.slice(1));
    const paths = [...el.querySelectorAll<SVGPathElement>(".d3s-plot path")];
    expect(paths.length).toBe(3);
    expect(paths.every((p) => (p.getAttribute("d") ?? "").startsWith("M"))).toBe(true);
  });
});

describe("series colors", () => {
  it("gives named series their fixed color, and the others the palette in name order", () => {
    const theme = { ...lightTheme, color: { ...lightTheme.color, named: { Churn: "#dc3309" } } };
    const color = stableColors()(theme, ["New", "Churn", "Expansion"]);
    // Colors are CSS vars; the theme's vars hold the values.
    expect(color("Churn")).toBe(`var(${namedVar("Churn")})`);
    expect(resolveColor(theme, color("Churn"), false)).toBe("#dc3309");
    expect(themeToCssVars(theme)[namedVar("Churn")]).toBe("#dc3309");
    // Churn takes no palette slot: Expansion and New are the first two.
    expect(color("Expansion")).toBe("var(--d3s-series-0)");
    expect(color("New")).toBe("var(--d3s-series-1)");
    // A name only on the object's prototype is not a named color.
    expect(color("constructor")).toBe("var(--d3s-series-2)");
  });
});

describe("band labels", () => {
  it("keeps every label that fits, else every nth", () => {
    expect(bandLabelEvery(["26-01", "26-02"], 80)).toBe(1);
    expect(bandLabelEvery(["26-01", "26-02"], 30)).toBe(2);
    expect(bandLabelEvery([], 0)).toBe(1);
  });
});
