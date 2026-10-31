import * as d3 from "d3";
import type { Row } from "../data/types";
import { fnv1a, lightDark, namedVar, type Theme } from "../theme/theme";
import type { Aggregate, ChartContext, ChartSpec, Level, Threshold } from "./types";
import { isDimmed, noInteractions, type Interactions, type RangeValue } from "./interactions";

export const margin = { top: 8, right: 12, bottom: 24, left: 44 };

type Margin = typeof margin;

/**
 * An SVG that follows the width of its container. Where the container cannot be measured (a
 * server-side DOM), `data-d3s-width` on it gives the width to draw at; else 400.
 */
export function createFrame(el: HTMLElement, height: number, onResize: () => void, m: Margin = margin) {
  el.classList.add("d3s-chart");
  el.style.height = `${height}px`;
  const svg = d3.select(el).append("svg").attr("height", height);
  const size = { width: el.clientWidth || Number(el.dataset.d3sWidth) || 400, height };
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
 * How often a category label shows on a horizontal band axis: 1 when the longest label fits its
 * band, else the smallest n so that every nth label fits. A label is estimated at 6.5px a
 * character plus 6px of space, the same estimate as the server renderer.
 */
export function bandLabelEvery(domain: string[], step: number): number {
  const longest = d3.max(domain, (d) => String(d).length) ?? 0;
  return step > 0 ? Math.max(1, Math.ceil((longest * 6.5 + 6) / step)) : 1;
}

/**
 * The look options of an x/y chart (`spec.options`): `ticks: "edges"`, `valueAxis: "right"`,
 * and `axes: "none"`.
 */
export function xyLook(spec: ChartSpec) {
  return {
    edges: spec.options?.ticks === "edges",
    right: spec.options?.valueAxis === "right",
    none: spec.options?.axes === "none",
  };
}

/**
 * The frame margin of an x/y chart. Without axes there is no margin. With the value axis on the
 * right (and values on y), the space moves to the right.
 */
export function xyMargin(spec: ChartSpec, base: Margin = margin, valueOnX = false): Margin {
  const look = xyLook(spec);
  if (look.none) return { top: 0, right: 0, bottom: 0, left: 0 };
  return look.right && !valueOnX ? { ...base, left: 12, right: 56 } : base;
}

/** The first and last of sorted values, for `ticks: "edges"`. One value gives one tick. */
export function edgesOf<T>(values: T[]): T[] {
  return values.length > 1 ? [values[0]!, values.at(-1)!] : values.slice();
}

/**
 * Draw the axes and the value grid lines.
 * `valueAxis` names the axis that carries values (and grid lines): `y` (default) or `x`.
 * `edges` (`ticks: "edges"`): the category axis shows only these values, and the value axis only
 * its domain ends, plus 0 when the domain crosses it. The bottom axis then anchors its first label
 * at its start and its last label at its end. Numbers on a linear category axis show as `String(x)`.
 * `right` (`valueAxis: "right"`): the value axis is on the right of the plot. No effect when the values are on x.
 * `none` (`axes: "none"`): nothing is drawn; the layers stay empty.
 */
export function renderAxes(
  layers: ReturnType<typeof createXYLayers>,
  x: AnyScale,
  y: AnyScale,
  o: {
    w: number;
    h: number;
    fmt: (n: number) => string;
    valueAxis?: "x" | "y";
    edges?: d3.AxisDomain[];
    right?: boolean;
    none?: boolean;
  },
) {
  if (o.none) return;
  const valueOnX = o.valueAxis === "x";
  const right = Boolean(o.right) && !valueOnX;
  const fmtTick = (v: d3.AxisDomain) => (typeof v === "number" ? o.fmt(v) : String(v));
  const xAxis = d3.axisBottom(x).tickSizeOuter(0);
  const yAxis = (right ? d3.axisRight(y) : d3.axisLeft(y)).tickSizeOuter(0);
  if (valueOnX) xAxis.ticks(Math.max(2, o.w / 80)).tickFormat(fmtTick);
  else if ("ticks" in x) xAxis.ticks(Math.max(2, o.w / 90));
  else if ("step" in x) {
    // Category labels that do not fit their band: keep every nth one, from the first.
    const band = x as d3.ScaleBand<string>;
    const every = bandLabelEvery(band.domain(), band.step());
    if (every > 1) xAxis.tickValues(band.domain().filter((_, i) => i % every === 0));
  }
  if (!valueOnX) yAxis.ticks(5).tickFormat(fmtTick);

  // Edges: the value domain ends (and 0), and the given category values.
  let valueTicks: number[] | undefined;
  if (o.edges) {
    const [lo, hi] = (valueOnX ? x : y).domain() as [number, number];
    valueTicks = lo < 0 && hi > 0 ? [lo, 0, hi] : [lo, hi];
    (valueOnX ? xAxis : yAxis).tickValues(valueTicks);
    (valueOnX ? yAxis : xAxis).tickValues(o.edges);
    if (!valueOnX && "ticks" in x && !(o.edges[0] instanceof Date)) xAxis.tickFormat(String);
  }

  layers.xAxis.attr("transform", `translate(0,${o.h})`).call(xAxis);
  if (right) layers.yAxis.attr("transform", `translate(${o.w},0)`);
  layers.yAxis.call(yAxis);
  if (o.edges) {
    const labels = layers.xAxis.selectAll<SVGTextElement, unknown>(".tick text");
    const n = labels.size();
    if (n > 1) labels.attr("text-anchor", (_, i) => (i === 0 ? "start" : i === n - 1 ? "end" : null));
  }
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
  if (valueTicks) grid.tickValues(valueTicks);
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

/**
 * A status color, as a CSS var. Every color a chart draws is a `var(--d3s-…)` (or a mix of them),
 * so it follows the theme's light and dark values with no redraw.
 */
export function levelColor(_theme: Theme, level: Level): string {
  return level === "ok" ? "var(--d3s-positive)" : level === "warning" ? "var(--d3s-warning)" : "var(--d3s-negative)";
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

/**
 * A color of the sequential scale at `t` in [0, 1]: a mix of `--d3s-seq-0` and `--d3s-seq-1`.
 * The share is rounded to 0.1 %, like the server renderer.
 */
export function seqColor(t: number): string {
  const p = Math.round(Math.min(1, Math.max(0, t)) * 1000) / 10;
  return `color-mix(in oklab, var(--d3s-seq-1) ${p}%, var(--d3s-seq-0))`;
}

const TOKENS: Record<string, keyof Theme["color"]> = {
  bg: "background",
  surface: "surface",
  text: "text",
  "text-muted": "textMuted",
  grid: "grid",
  axis: "axis",
  accent: "accent",
  positive: "positive",
  warning: "warning",
  negative: "negative",
};

/** The color a chart color stands for, in light (`dark` false) or dark mode. */
export function resolveColor(theme: Theme, color: string, dark: boolean): string {
  const c = theme.color;
  const d = dark ? (theme.dark ?? {}) : {};
  let m = /^var\(--d3s-series-(\d+)\)$/.exec(color);
  if (m) return d.series?.[+m[1]!] ?? c.series[+m[1]!]!;
  m = /^var\(--d3s-named-([0-9a-f]{8})\)$/.exec(color);
  if (m) {
    const name = Object.keys(c.named ?? {}).find((k) => fnv1a(k) === m![1]);
    return name === undefined ? "#000" : (d.named?.[name] ?? c.named![name]!);
  }
  m = /^color-mix\(in oklab, var\(--d3s-seq-1\) ([\d.]+)%, var\(--d3s-seq-0\)\)$/.exec(color);
  if (m) {
    const [a, b] = d.sequential ?? c.sequential;
    return d3.interpolateLab(a, b)(Number(m[1]) / 100);
  }
  m = /^var\(--d3s-([a-z-]+)\)$/.exec(color);
  const token = m ? TOKENS[m[1]!] : undefined;
  if (token) return ((d[token] ?? c[token]) as string) ?? color;
  return color;
}

/** Readable text color on a filled shape, in both modes: `light-dark(…)` when they differ. */
export function textOn(theme: Theme, fill: string): string {
  const on = (dark: boolean) => (d3.hsl(resolveColor(theme, fill, dark)).l > 0.6 ? "#111" : "#fff");
  return lightDark(on(false), theme.dark ? on(true) : undefined);
}

/** Transition length. 0 when the user asks for reduced motion. */
export function motionMs(theme: Theme): number {
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduce ? 0 : theme.motion;
}

/** Natural sort for labels: `host-2` before `host-10`. */
export const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export { fnv1a };

/** Id of the area gradient of series number `i` (in name order): unique per chart spec and series. */
export function gradientId(spec: ChartSpec, i: number): string {
  const key = [spec.type, spec.title ?? "", spec.x ?? "", spec.y ?? "", spec.series ?? ""].join("|");
  return `d3s-grad-${fnv1a(key)}-${i}`;
}

/**
 * Colors that stay with their key for the life of a chart. With live data the set and order of keys
 * change; a plain ordinal scale would then give a series a new color.
 * New keys get the next palette color, in name order within one call. A key the theme names
 * (`color.named`) always gets its fixed color and takes no palette slot.
 */
export function stableColors() {
  const assigned = new Map<string, number>();
  return (theme: Theme, keys: string[]) => {
    const named = theme.color.named ?? {};
    const fixed = (k: string) => Object.prototype.hasOwnProperty.call(named, k);
    for (const k of [...keys].sort(byName)) if (!fixed(k) && !assigned.has(k)) assigned.set(k, assigned.size);
    const size = theme.color.series.length;
    return (k: string) => {
      if (fixed(k)) return `var(${namedVar(k)})`;
      if (!assigned.has(k)) assigned.set(k, assigned.size);
      return `var(--d3s-series-${assigned.get(k)! % size})`;
    };
  };
}

export function seriesColor(theme: Theme, keys: string[]) {
  return d3
    .scaleOrdinal<string, string>()
    .domain(keys)
    .range(theme.color.series.map((_, i) => `var(--d3s-series-${i})`));
}

/** The sequential scale over `domain`, as `seqColor`. A collapsed domain maps to the middle. */
export function sequentialColor(_theme: Theme, domain: [number, number]) {
  const [a, b] = domain;
  return (x: number) => seqColor(a === b ? 0.5 : (x - a) / (b - a));
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

/**
 * An interactive legend placed after the chart element. Hidden when there is one key or fewer
 * (unless `force`).
 * - Click: show only this key. Click it again: show all keys.
 * - Shift-, Ctrl-, or Cmd-click: hide or show this key.
 */
export function createLegend(el: HTMLElement, onChange: () => void = () => {}) {
  const legend = document.createElement("div");
  legend.className = "d3s-legend";
  el.after(legend);
  const hidden = new Set<string>();
  let keys: string[] = [];

  const click = (key: string, event: MouseEvent) => {
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      if (hidden.has(key)) hidden.delete(key);
      else hidden.add(key);
    } else {
      const isolated = !hidden.has(key) && keys.every((k) => k === key || hidden.has(k));
      hidden.clear();
      if (!isolated) for (const k of keys) if (k !== key) hidden.add(k);
    }
    // Never hide every key.
    if (keys.length && keys.every((k) => hidden.has(k))) hidden.clear();
    onChange();
  };

  return {
    /** Keys the user has hidden. */
    hidden: hidden as ReadonlySet<string>,
    visible: (key: string) => !hidden.has(key),
    update(next: string[], color: (k: string) => string, force = false) {
      keys = next;
      legend.hidden = !force && keys.length <= 1;
      legend.replaceChildren(
        ...keys.map((k) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "d3s-legend-item";
          item.setAttribute("aria-pressed", String(!hidden.has(k)));
          item.title = "Click: show only this. Shift-click: hide or show.";
          const sw = document.createElement("i");
          sw.style.background = color(k);
          item.append(sw, k);
          item.addEventListener("click", (e) => click(k, e));
          return item;
        }),
      );
    },
    destroy: () => legend.remove(),
  };
}

export type Legend = ReturnType<typeof createLegend>;

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
    .style("stroke", (t) => thresholdColor(theme, t));
  g.select("text")
    .attr("x", w)
    .style("fill", (t) => thresholdColor(theme, t))
    .text((t) => t.label ?? `${t.op} ${fmt(t.value)}`);
}

export function interactionsOf(ctx: ChartContext): Interactions {
  return ctx.interactions ?? noInteractions;
}

/** Opacity for a mark: dimmed when a selection on `field` excludes `value`. */
export function dimOpacity(i: Interactions, field: string | undefined, value: string, base = 1): number {
  return isDimmed(i, field, value) ? base * 0.25 : base;
}

/**
 * Click on a mark to cross-filter `field` by `value(d)`. Shift-click adds to the selection.
 * Marks get a pointer cursor.
 */
export function bindSelect<E extends Element, D>(
  sel: d3.Selection<E, D, d3.BaseType, unknown>,
  i: Interactions,
  field: string | undefined,
  value: (d: D) => string,
) {
  if (!field) return;
  sel.style("cursor", "pointer").on("click.d3s", (event, d) => {
    const e = event as MouseEvent;
    e.stopPropagation();
    i.toggle(field, value(d), e.shiftKey || e.metaKey || e.ctrlKey);
  });
}

/** Same as `bindSelect` plus dimming, for HTML elements built by hand. */
export function selectOnClick(el: HTMLElement, i: Interactions, field: string | undefined, value: string) {
  if (!field) return;
  el.style.opacity = String(dimOpacity(i, field, value));
  el.style.cursor = "pointer";
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    i.toggle(field, value, event.shiftKey || event.metaKey || event.ctrlKey);
  });
}

type Invertible = { invert(px: number): number | Date };

const toRange = (lo: number | Date, hi: number | Date): RangeValue =>
  lo instanceof Date ? { from: lo.toISOString(), to: (hi as Date).toISOString() } : { min: +lo, max: +hi };

/**
 * A brush that sets range filters: on `xField` (mode `x`), or on `xField` and `yField` (mode `xy`).
 * Double-click clears the ranges. Returns the brush group, so callers can add hover handlers to it,
 * and a `resize` function.
 */
export function rangeBrush(
  plot: d3.Selection<SVGGElement, unknown, null, undefined>,
  o: {
    mode: "x" | "xy";
    x: () => Invertible;
    y?: () => Invertible;
    xField: string;
    yField?: string;
    interactions: Interactions;
  },
) {
  // An explicit extent: the default one reads SVG sizes that are not always available.
  const brush = (o.mode === "x" ? d3.brushX<unknown>() : d3.brush<unknown>()).extent([
    [0, 0],
    [1, 1],
  ]);
  const g = plot.append("g").attr("class", "d3s-brush");
  brush.on("end", (event: d3.D3BrushEvent<unknown>) => {
    if (!event.selection || !event.sourceEvent) return;
    g.call(brush.move, null);
    const x = o.x();
    if (o.mode === "x") {
      const [a, b] = event.selection as [number, number];
      if (b - a < 4) return;
      o.interactions.setRange(o.xField, toRange(x.invert(a), x.invert(b)));
      return;
    }
    const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]];
    if (x1 - x0 < 4 && y1 - y0 < 4) return;
    const y = o.y!();
    if (x1 - x0 >= 4) o.interactions.setRange(o.xField, toRange(x.invert(x0), x.invert(x1)));
    // Screen y grows downward: the bottom edge is the low value.
    if (y1 - y0 >= 4 && o.yField) o.interactions.setRange(o.yField, toRange(y.invert(y1), y.invert(y0)));
  });
  let size: [number, number] = [0, 0];
  g.call(brush).on("dblclick.d3s", () => {
    o.interactions.setRange(o.xField, undefined);
    if (o.mode === "xy" && o.yField) o.interactions.setRange(o.yField, undefined);
  });
  return {
    g,
    resize(w: number, h: number) {
      // Re-apply the brush only on a size change: re-applying it during a drag (live data redraws) cancels the drag.
      if (w === size[0] && h === size[1]) return;
      size = [w, h];
      brush.extent([
        [0, 0],
        [Math.max(1, w), Math.max(1, h)],
      ]);
      g.call(brush);
    },
  };
}
