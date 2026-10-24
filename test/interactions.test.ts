import { describe, expect, it } from "vitest";
import {
  createDashboard,
  getChart,
  lightTheme,
  registerChart,
  select,
  staticSource,
  type Interactions,
} from "../src/index";

const theme = { ...lightTheme, motion: 0 };
const rows = [
  { region: "EU", product: "Pro", amount: 10, at: new Date(Date.now() - 60_000).toISOString() },
  { region: "US", product: "Pro", amount: 20, at: new Date(Date.now() - 30_000).toISOString() },
  { region: "APAC", product: "Starter", amount: 40, at: new Date(Date.now() - 3_600_000).toISOString() },
];

// A test chart that exposes its interactions and the rows it receives.
let probe: { ix: Interactions; rows: Record<string, unknown>[] }[] = [];
registerChart("probe", (_el, _spec, ctx) => {
  const p = { ix: ctx.interactions!, rows: [] as Record<string, unknown>[] };
  probe.push(p);
  return { update: (r) => (p.rows = r), setTheme() {}, destroy() {} };
});

const mount = (extra: Partial<Parameters<typeof createDashboard>[1]> = {}) => {
  probe = [];
  const el = document.createElement("div");
  const src = staticSource(rows);
  const dash = createDashboard(el, {
    theme,
    source: src,
    charts: [{ type: "bar", x: "region", y: "amount" }, { type: "kpi", y: "amount" }, { type: "probe" }],
    ...extra,
  });
  const kpi = () => el.querySelector(".d3s-kpi-value")!.textContent;
  const bars = () => [...el.querySelectorAll<SVGRectElement>(".d3s-plot rect")];
  return { el, src, dash, kpi, bars };
};

const click = (target: Element, init: MouseEventInit = {}) =>
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));

describe("cross-filter", () => {
  it("click filters the other charts and dims the clicked chart", () => {
    const { el, kpi, bars } = mount();
    expect(kpi()).toBe("70");
    const us = bars().find((b) => (b as unknown as { __data__: { category: string } }).__data__.category === "US")!;
    click(us);
    expect(kpi()).toBe("20");
    // The bar chart keeps all bars; the others are dimmed.
    expect(bars()).toHaveLength(3);
    expect(bars().map((b) => b.getAttribute("opacity"))).toEqual(["0.25", "1", "0.25"]);
    // A chip shows the filter and removes it.
    expect(el.querySelector(".d3s-chip")!.textContent).toContain("Region: US");
    click(el.querySelector(".d3s-chip button")!);
    expect(kpi()).toBe("70");
    expect(el.querySelector(".d3s-chip")).toBeNull();
  });

  it("shift-click adds values; click on the only value clears", () => {
    const { kpi } = mount();
    const ix = probe[0]!.ix;
    ix.toggle("region", "EU");
    ix.toggle("region", "US", true);
    expect(kpi()).toBe("30");
    ix.toggle("region", "US", true);
    expect(kpi()).toBe("10");
    ix.toggle("region", "EU");
    expect(kpi()).toBe("70");
  });

  it("uses a declared select filter and syncs the filter bar", () => {
    const { el, kpi } = mount({ filters: [select("region")] });
    probe[0]!.ix.toggle("region", "APAC");
    expect(kpi()).toBe("40");
    expect(el.querySelector<HTMLSelectElement>(".d3s-filters select")!.value).toBe("APAC");
  });
});

describe("ranges", () => {
  it("a range applies to every chart, the one that set it too; undefined clears it", () => {
    const { kpi } = mount();
    const p = probe[0]!;
    p.ix.setRange("amount", { min: 15, max: 30 });
    expect(kpi()).toBe("20");
    expect(p.rows).toHaveLength(1);
    p.ix.setRange("amount", undefined);
    expect(kpi()).toBe("70");
  });

  it("time window and pause", () => {
    const { dash, src, kpi, el } = mount({ timeField: "at" });
    expect(el.querySelectorAll(".d3s-segmented button")).toHaveLength(6);
    dash.setTimeWindow("15m");
    expect(kpi()).toBe("30");
    dash.setPaused(true);
    src.set([...rows, { region: "EU", amount: 100, at: new Date().toISOString() }]);
    expect(kpi()).toBe("30");
    expect(el.querySelector(".d3s-status")!.textContent).toBe("Paused");
    dash.setPaused(false);
    expect(kpi()).toBe("130");
  });

  it("a time window clears a brush range on the time field", () => {
    const { dash, kpi } = mount({ timeField: "at" });
    probe[0]!.ix.setRange("at", { from: new Date(Date.now() - 45_000).toISOString(), to: new Date().toISOString() });
    expect(kpi()).toBe("20");
    dash.setTimeWindow("all");
    expect(kpi()).toBe("70");
  });
});

describe("shared hover", () => {
  it("between two time charts", () => {
    probe = [];
    const el = document.createElement("div");
    createDashboard(el, { theme, source: staticSource(rows), charts: [{ type: "probe" }, { type: "probe" }] });
    const got: Array<number | undefined> = [];
    probe[1]!.ix.onHoverTime((t) => got.push(t));
    probe[1]!.ix.hoverTime(1); // own hover: not echoed back
    probe[0]!.ix.hoverTime(42);
    expect(got).toEqual([42]);
  });
});

describe("legend", () => {
  it("click isolates a series, shift-click toggles one", () => {
    const el = document.createElement("div");
    document.body.append(el);
    const chart = getChart("line")(el, { type: "line", x: "at", y: "amount", series: "region" }, { theme });
    chart.update(rows);
    const paths = () => el.querySelectorAll(".d3s-plot path").length;
    const items = () => [...document.querySelectorAll<HTMLButtonElement>(".d3s-legend-item")];
    expect(paths()).toBe(3);
    click(items()[0]!);
    expect(paths()).toBe(1);
    expect(items().map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
    click(items()[1]!, { shiftKey: true });
    expect(paths()).toBe(2);
    click(items()[0]!, { shiftKey: true });
    click(items()[1]!, { shiftKey: true });
    // Hiding the last visible series shows all of them again.
    expect(paths()).toBe(3);
    chart.destroy();
    el.remove();
  });
});

describe("stable series", () => {
  it("keeps legend order and colors when live data changes the first-seen order", () => {
    const el = document.createElement("div");
    document.body.append(el);
    const chart = getChart("line")(el, { type: "line", x: "at", y: "amount", series: "region" }, { theme });
    const legend = () =>
      [...document.querySelectorAll<HTMLElement>(".d3s-legend-item")].map(
        (b) => `${b.textContent}:${b.querySelector("i")!.style.background}`,
      );
    chart.update(rows);
    const before = legend();
    chart.update([...rows].reverse());
    expect(legend()).toEqual(before);
    expect(before.map((s) => s.split(":")[0])).toEqual(["APAC", "EU", "US"]);
    chart.destroy();
    el.remove();
  });
});
