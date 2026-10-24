import * as d3 from "d3";
import type { Row } from "../data/types";
import type { ChartFactory, ChartSpec } from "./types";
import {
  aggregate,
  bindTooltip,
  createFrame,
  createLegend,
  createTooltip,
  createXYLayers,
  margin,
  motionMs,
  need,
  renderAxes,
  seriesColor,
  topN,
  animate,
} from "./util";

interface Bar {
  category: string;
  series: string;
  value: number;
  /** Value-axis start and end of the rectangle. */
  v0: number;
  v1: number;
}

interface BarData {
  categories: string[];
  seriesKeys: string[];
  bars: Bar[];
}

export function toBars(rows: Row[], spec: ChartSpec, xField: string, yField: string): BarData {
  const how = spec.aggregate ?? "sum";
  const seriesOf = (r: Row) => (spec.series ? String(r[spec.series]) : yField);

  // Keep the largest categories when `limit` is set. The others become "Other".
  let catOf = (r: Row) => String(r[xField]);
  if (spec.limit) {
    const totals = d3.rollups(
      rows,
      (v) =>
        aggregate(
          v.map((r) => Number(r[yField])),
          how,
        ),
      catOf,
    );
    const kept = new Set(topN(totals, spec.limit).map(([k]) => k));
    const base = catOf;
    catOf = (r) => (kept.has(base(r)) ? base(r) : "Other");
  }

  const nested = d3.rollups(
    rows,
    (v) =>
      aggregate(
        v.map((r) => Number(r[yField])),
        how,
      ),
    catOf,
    seriesOf,
  );
  const categories = nested.map(([c]) => c);
  const seriesKeys = [...new Set(nested.flatMap(([, inner]) => inner.map(([s]) => s)))];
  if (spec.limit) {
    const total = (c: string) => d3.sum(nested.find(([k]) => k === c)![1], (e) => e[1]);
    categories.sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : total(b) - total(a)));
  }

  let bars: Bar[];
  if (spec.stacked) {
    const wide = categories.map((c) => {
      const inner = new Map(nested.find(([k]) => k === c)![1]);
      return Object.fromEntries(seriesKeys.map((s) => [s, inner.get(s) ?? 0])) as Record<string, number>;
    });
    const stack = d3.stack<Record<string, number>>().keys(seriesKeys).offset(d3.stackOffsetDiverging)(wide);
    bars = stack.flatMap((layer) =>
      layer.map((p, i) => ({
        category: categories[i]!,
        series: layer.key,
        value: p.data[layer.key] ?? 0,
        v0: p[0],
        v1: p[1],
      })),
    );
  } else {
    bars = nested.flatMap(([category, inner]) =>
      inner.map(([series, value]) => ({ category, series, value, v0: Math.min(0, value), v1: Math.max(0, value) })),
    );
  }
  return { categories, seriesKeys, bars };
}

/**
 * Bars by category. Series are grouped side by side, or stacked with `stacked: true`.
 * `horizontal: true` puts categories on the y axis. Default aggregate: `sum`.
 */
export const barChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const horizontal = spec.horizontal ?? false;
  const fmt = d3.format(spec.format ?? ".3~s");
  let data = toBars([], spec, xField, yField);

  const frame = createFrame(el, spec.height ?? 240, () => draw(false), horizontal ? { ...margin, left: 88 } : margin);
  const layers = createXYLayers(frame);
  const legend = createLegend(el);
  const tooltip = createTooltip(el);

  function draw(animated = true) {
    const { w, h } = frame.inner();
    const { categories, seriesKeys, bars } = data;
    const band = d3
      .scaleBand()
      .domain(categories)
      .range(horizontal ? [0, h] : [0, w])
      .paddingInner(0.2)
      .paddingOuter(0.1);
    const sub = d3
      .scaleBand()
      .domain(spec.stacked ? ["all"] : seriesKeys)
      .range([0, band.bandwidth()])
      .padding(0.05);
    const lo = Math.min(0, d3.min(bars, (b) => b.v0) ?? 0);
    const hi = Math.max(0, d3.max(bars, (b) => b.v1) ?? 1) || 1;
    const value = d3
      .scaleLinear()
      .domain([lo, hi])
      .nice()
      .range(horizontal ? [0, w] : [h, 0]);
    const color = seriesColor(theme, seriesKeys);
    const ms = animated ? motionMs(theme) : 0;

    if (horizontal) renderAxes(layers, value as never, band as never, { w, h, fmt, valueAxis: "x" });
    else renderAxes(layers, band as never, value as never, { w, h, fmt });

    const offset = (b: Bar) => (band(b.category) ?? 0) + (sub(spec.stacked ? "all" : b.series) ?? 0);
    const zero = value(0);
    // Rectangle geometry for a bar, and the collapsed geometry at the baseline.
    const rect = (b: Bar) =>
      horizontal
        ? { x: value(b.v0), y: offset(b), width: Math.abs(value(b.v1) - value(b.v0)), height: sub.bandwidth() }
        : { x: offset(b), y: value(b.v1), width: sub.bandwidth(), height: Math.abs(value(b.v0) - value(b.v1)) };
    const flat = (b: Bar) => (horizontal ? { ...rect(b), x: zero, width: 0 } : { ...rect(b), y: zero, height: 0 });
    // Works for a selection or a transition: both have the same `attr` calls.
    const apply = (
      sel:
        | d3.Selection<SVGRectElement, Bar, SVGGElement, unknown>
        | d3.Transition<SVGRectElement, Bar, SVGGElement, unknown>,
      geo: (b: Bar) => ReturnType<typeof rect>,
    ) =>
      (sel as d3.Selection<SVGRectElement, Bar, SVGGElement, unknown>)
        .attr("x", (b) => geo(b).x)
        .attr("y", (b) => geo(b).y)
        .attr("width", (b) => geo(b).width)
        .attr("height", (b) => geo(b).height);

    layers.plot
      .selectAll<SVGRectElement, Bar>("rect")
      .data(bars, (b) => `${b.category}\u0000${b.series}`)
      .join(
        (enter) => apply(enter.append("rect"), flat),
        (update) => update,
        (exit) => apply(animate(exit, ms) as never, flat).remove(),
      )
      .attr("rx", Math.min(3, theme.radius))
      .attr("fill", (b) => color(b.series))
      .call((s) => bindTooltip(s, tooltip, (b) => [b.category, `${b.series}: ${fmt(b.value)}`]))
      .call((s) => apply(animate(s, ms) as never, rect));

    legend.update(seriesKeys, color);
  }

  return {
    update(rows) {
      data = toBars(rows, spec, xField, yField);
      draw();
    },
    setTheme(next) {
      theme = next;
      draw(false);
    },
    destroy() {
      tooltip.destroy();
      legend.destroy();
      frame.destroy();
    },
  };
};
