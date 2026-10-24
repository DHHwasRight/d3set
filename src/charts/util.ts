import * as d3 from "d3";
import type { Row } from "../data/types";
import type { Theme } from "../theme/theme";
import type { Aggregate, ChartSpec, Level, Threshold } from "./types";

export const margin = { top: 8, right: 12, bottom: 24, left: 44 };

type Margin = typeof margin;

/** An SVG that follows the width of its container. */
export function createFrame(el: HTMLElement, height: number, onResize: () => void, m: Margin = margin) {
  el.classList.add("d3s-chart");
  el.style.height = `${height}px`;
  const svg = d3.select(el).append("svg").attr("height", height);
  const size = { width: el.clientWidth || 400, height };
  let ro: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? size.width);
      if (w > 0 && w !== size.width) {
        size.width = w;
        svg.attr("width", w);
        onResize();
      }
    });
    ro.observe(el);
  }
  svg.attr("width", size.width);
  return {
    svg,
    size,
    margin: m,
    inner: () => ({
      w: Math.max(0, size.width - m.left - m.right),
      h: Math.max(0, size.height - m.top - m.bottom),
    }),
    destroy() {
      ro?.disconnect();
      svg.remove();
    },
  };
}

export type Frame = ReturnType<typeof createFrame>;

/** Layers for a chart with x and y axes: grid, axes, then the plot on top. */
export function createXYLayers(frame: Frame) {
  const g = frame.svg.append("g").attr("transform", `translate(${frame.margin.left},${frame.margin.top})`);
  return {
    g,
    grid: g.append("g").attr("class", "d3s-gridlines"),
    xAxis: g.append("g").attr("class", "d3s-axis-x"),
    yAxis: g.append("g").attr("class", "d3s-axis-y"),
    plot: g.append("g").attr("class", "d3s-plot"),
  };
}

type AnyScale = d3.AxisScale<d3.AxisDomain>;

/**
 * Draw the axes and the value grid lines.
 * `valueAxis` names the axis that carries values (and grid lines): `y` (default) or `x`.
 */
export function renderAxes(
  layers: ReturnType<typeof createXYLayers>,
  x: AnyScale,
  y: AnyScale,
  o: { w: number; h: number; fmt: (n: number) => string; valueAxis?: "x" | "y" },
) {
  const valueOnX = o.valueAxis === "x";
  const fmtTick = (v: d3.AxisDomain) => (typeof v === "number" ? o.fmt(v) : String(v));
  const xAxis = d3.axisBottom(x).tickSizeOuter(0);
  const yAxis = d3.axisLeft(y).tickSizeOuter(0);
  if (valueOnX) xAxis.ticks(Math.max(2, o.w / 80)).tickFormat(fmtTick);
  else if ("ticks" in x) xAxis.ticks(Math.max(2, o.w / 90));
  if (!valueOnX) yAxis.ticks(5).tickFormat(fmtTick);

  layers.xAxis.attr("transform", `translate(0,${o.h})`).call(xAxis);
  layers.yAxis.call(yAxis);
  layers.grid.selectAll("*").remove();
  const grid = valueOnX
    ? d3
        .axisBottom(x)
        .ticks(Math.max(2, o.w / 80))
        .tickSize(o.h)
        .tickFormat(() => "")
    : d3
        .axisLeft(y)
        .ticks(5)
        .tickSize(-o.w)
        .tickFormat(() => "");
  layers.grid.call(grid).call((s) => s.select(".domain").remove());
}

/**
 * A transition of `ms`, or the selection itself when `ms` is 0.
 * With 0, attributes apply at once. This matters for live data: when updates come faster
 * than animation frames, each new transition would cancel the one before it, and nothing would draw.
 * The result is typed as a transition, but only use methods that a selection also has (`attr`, `style`, `remove`).
 */
export function animate<E extends d3.BaseType, D, P extends d3.BaseType, PD>(
  sel: d3.Selection<E, D, P, PD>,
  ms: number,
): d3.Transition<E, D, P, PD> {
  return ms > 0 ? sel.transition().duration(ms) : (sel.interrupt() as unknown as d3.Transition<E, D, P, PD>);
}

/**
 * Animate a `translate(x,y)` transform. A string interpolation is enough for
 * translations and does not need the SVG transform API.
 */
export function tweenTranslate<E extends SVGElement, D>(
  sel: d3.Selection<E, D, d3.BaseType, unknown>,
  ms: number,
  to: (d: D) => [number, number],
) {
  if (ms <= 0) {
    sel.attr("transform", (d) => `translate(${to(d).join(",")})`);
    return;
  }
  sel
    .transition()
    .duration(ms)
    .attrTween("transform", function (d) {
      const [x, y] = to(d);
      const target = `translate(${x},${y})`;
      return d3.interpolateString(this.getAttribute("transform") ?? target, target);
    });
}

const units: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

/** Parse an interval such as `30s`, `5m`, `1h`, `1d` into milliseconds. */
export function parseInterval(interval: string): number {
  const m = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w)$/.exec(interval.trim());
  if (!m)
    throw new Error(
      `d3set: invalid interval '${interval}'. Use a number and a unit: ms, s, m, h, d, w (for example '5m').`,
    );
  return Number(m[1]) * units[m[2]!]!;
}

/** Floor a date to the start of its bucket. Buckets are aligned to UTC. */
export function bucket(date: Date, ms: number): Date {
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

/** The first threshold rule that matches `value`, if any. */
export function matchThreshold(value: number, rules: Threshold[] = []): Threshold | undefined {
  return rules.find((t) => {
    switch (t.op) {
      case ">":
        return value > t.value;
      case ">=":
        return value >= t.value;
      case "<":
        return value < t.value;
      case "<=":
        return value <= t.value;
      case "=":
        return value === t.value;
    }
  });
}

export function levelColor(theme: Theme, level: Level): string {
  return level === "ok" ? theme.color.positive : level === "warning" ? theme.color.warning : theme.color.negative;
}

/** Color of a threshold rule: its own color, else its level color. */
export function thresholdColor(theme: Theme, t: Threshold): string {
  return t.color ?? levelColor(theme, t.level ?? "critical");
}

/** Color for `value` from the threshold rules, or `fallback` when no rule matches. */
export function valueColor(theme: Theme, value: number, rules: Threshold[] | undefined, fallback: string): string {
  const t = matchThreshold(value, rules);
  return t ? thresholdColor(theme, t) : fallback;
}

/** Readable text color on a filled shape. */
export function textOn(fill: string): string {
  return d3.hsl(fill).l > 0.6 ? "#111" : "#fff";
}

/** Transition length. 0 when the user asks for reduced motion. */
export function motionMs(theme: Theme): number {
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduce ? 0 : theme.motion;
}

export function seriesColor(theme: Theme, keys: string[]) {
  return d3.scaleOrdinal<string, string>().domain(keys).range(theme.color.series);
}

export function sequentialColor(theme: Theme, domain: [number, number]) {
  return d3.scaleSequential(d3.interpolateLab(...theme.color.sequential)).domain(domain);
}

export function aggregate(values: number[], how: Aggregate): number {
  switch (how) {
    case "sum":
      return d3.sum(values);
    case "count":
      return values.length;
    case "avg":
      return d3.mean(values) ?? 0;
    case "min":
      return d3.min(values) ?? 0;
    case "max":
      return d3.max(values) ?? 0;
    case "last":
      return values[values.length - 1] ?? 0;
  }
}

/** Read a required spec field, or fail with a clear message. */
export function need(spec: ChartSpec, field: "x" | "y" | "series"): string {
  const v = spec[field];
  if (!v) throw new Error(`d3set: chart type '${spec.type}' requires field '${field}'.`);
  return v;
}

/** Parse a cell as a Date when it looks like a date, else return undefined. */
export function asDate(v: unknown): Date | undefined {
  if (v instanceof Date) return v;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v);
  return undefined;
}

/** Group rows by `key` and aggregate `value`. Keeps first-seen key order. */
export function rollup(rows: Row[], key: (r: Row) => string, value: string, how: Aggregate): Array<[string, number]> {
  return d3.rollups(
    rows,
    (v) =>
      aggregate(
        v.map((r) => Number(r[value])),
        how,
      ),
    key,
  );
}

/** Keep the `limit` largest entries. The others become one "Other" entry. */
export function topN(entries: Array<[string, number]>, limit?: number): Array<[string, number]> {
  if (!limit || entries.length <= limit) return entries;
  const sorted = entries.slice().sort((a, b) => b[1] - a[1]);
  const rest = d3.sum(sorted.slice(limit - 1), (e) => e[1]);
  return [...sorted.slice(0, limit - 1), ["Other", rest]];
}

/** A legend placed after the chart element. Hidden when there is one series or fewer. */
export function createLegend(el: HTMLElement) {
  const legend = document.createElement("div");
  legend.className = "d3s-legend";
  el.after(legend);
  return {
    update(keys: string[], color: (k: string) => string, force = false) {
      legend.hidden = !force && keys.length <= 1;
      legend.replaceChildren(
        ...keys.map((k) => {
          const item = document.createElement("span");
          const sw = document.createElement("i");
          sw.style.background = color(k);
          item.append(sw, k);
          return item;
        }),
      );
    },
    destroy: () => legend.remove(),
  };
}

/** A tooltip that follows the pointer inside the chart element. */
export function createTooltip(el: HTMLElement) {
  const tip = document.createElement("div");
  tip.className = "d3s-tooltip";
  tip.hidden = true;
  el.append(tip);
  return {
    show(event: MouseEvent, lines: string[]) {
      tip.replaceChildren(
        ...lines.map((l, i) => {
          const div = document.createElement("div");
          if (i === 0) div.className = "d3s-tooltip-title";
          div.textContent = l;
          return div;
        }),
      );
      tip.hidden = false;
      const [px, py] = d3.pointer(event, el);
      const left = Math.min(px + 12, el.clientWidth - tip.offsetWidth - 4);
      tip.style.left = `${Math.max(0, left)}px`;
      tip.style.top = `${Math.max(0, py - tip.offsetHeight - 8)}px`;
    },
    hide() {
      tip.hidden = true;
    },
    destroy: () => tip.remove(),
  };
}

/** Attach tooltip handlers to a selection. */
export function bindTooltip<E extends Element, D>(
  sel: d3.Selection<E, D, d3.BaseType, unknown>,
  tooltip: ReturnType<typeof createTooltip>,
  lines: (d: D) => string[],
) {
  sel
    .on("pointermove.d3s", (event, d) => tooltip.show(event as MouseEvent, lines(d)))
    .on("pointerleave.d3s", () => tooltip.hide());
}

/** Dashed horizontal marker lines at threshold values, with labels. */
export function renderMarkers(
  plot: d3.Selection<SVGGElement, unknown, null, undefined>,
  y: d3.ScaleLinear<number, number>,
  w: number,
  theme: Theme,
  rules: Threshold[] = [],
  fmt: (n: number) => string,
) {
  const [lo, hi] = y.domain() as [number, number];
  const visible = rules.filter((t) => t.value >= lo && t.value <= hi);
  const g = plot
    .selectAll<SVGGElement, Threshold>("g.d3s-marker")
    .data(visible)
    .join((enter) => {
      const e = enter.append("g").attr("class", "d3s-marker").attr("pointer-events", "none");
      e.append("line").attr("stroke-dasharray", "4 3").attr("stroke-width", 1.5);
      e.append("text").attr("class", "d3s-label-muted").attr("text-anchor", "end").attr("dy", "-0.35em");
      return e;
    })
    .raise();
  g.attr("transform", (t) => `translate(0,${y(t.value)})`);
  g.select("line")
    .attr("x2", w)
    .attr("stroke", (t) => thresholdColor(theme, t));
  g.select("text")
    .attr("x", w)
    .style("fill", (t) => thresholdColor(theme, t))
    .text((t) => t.label ?? `${t.op} ${fmt(t.value)}`);
}
