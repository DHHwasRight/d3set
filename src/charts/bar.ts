import * as d3 from "d3";
import type { Row } from "../data/types";
import type { ChartFactory, ChartSpec } from "./types";
import {
  aggregate,
  animate,
  bindSelect,
  bindTooltip,
  byName,
  createFrame,
  createLegend,
  createTooltip,
  createXYLayers,
  dimOpacity,
  edgesOf,
  interactionsOf,
  margin,
  motionMs,
  need,
  renderAxes,
  stableColors,
  topN,
  xyLook,
  xyMargin,
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

/** `options.labelWidth`: the category label column of a horizontal chart, 88 px by default. */
function labelWidth(spec: ChartSpec): number {
  const w = spec.options?.labelWidth;
  return typeof w === "number" && Number.isFinite(w) && w >= 0 ? w : 88;
}

/** `options.categories: "a|b|c"`: the fixed categories, in order, without repeats. */
export function fixedCategories(spec: ChartSpec): string[] | undefined {
  const c = spec.options?.categories;
  return typeof c === "string" && c !== "" ? [...new Set(c.split("|"))] : undefined;
}

export function toBars(rows: Row[], spec: ChartSpec, xField: string, yField: string): BarData {
  const how = spec.aggregate ?? "sum";
  const fixed = fixedCategories(spec);
  if (fixed) {
    const keep = new Set(fixed);
    rows = rows.filter((r) => keep.has(String(r[xField])));
  }
  const seriesOf = (r: Row) => (spec.series ? String(r[spec.series]) : yField);

  // Keep the largest categories when `limit` is set. The others become "Other".
  let catOf = (r: Row) => String(r[xField]);
  if (spec.limit && !fixed) {
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
  const categories = fixed ?? nested.map(([c]) => c);
  const seriesKeys = [...new Set(nested.flatMap(([, inner]) => inner.map(([s]) => s)))].sort(byName);
  // Stable order, so bars do not move while live data slides: by value with `limit`, else by name.
  if (fixed) {
    // Fixed order: nothing to sort.
  } else if (spec.limit) {
    const total = (c: string) => d3.sum(nested.find(([k]) => k === c)![1], (e) => e[1]);
    categories.sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : total(b) - total(a)));
  } else categories.sort(byName);

  let bars: Bar[];
  if (spec.stacked) {
    const wide = categories.map((c) => {
      const inner = new Map(nested.find(([k]) => k === c)?.[1]);
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
 * `options.labelWidth`: with `horizontal`, the width in px of the category labels, left of the plot
 * (88 by default). Long labels need more: plan or customer names.
 * `options.categories: "a|b|c"` fixes the categories and their order: a category with no rows keeps
 * its band, rows of other categories are left out (also from the legend), and `limit` is ignored.
 * `options.axes: "none"` draws no axes or grid lines and no margin, so the bars fill the frame.
 */
export const barChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const colors = stableColors();
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const horizontal = spec.horizontal ?? false;
  const fmt = d3.format(spec.format ?? ".3~s");
  const look = xyLook(spec);
  let data = toBars([], spec, xField, yField);

  const frame = createFrame(
    el,
    spec.height ?? 240,
    () => draw(false),
    xyMargin(spec, horizontal ? { ...margin, left: labelWidth(spec) } : margin, horizontal),
  );
  const layers = createXYLayers(frame);
  const legend = createLegend(el, () => {
    data = toBars(
      rows.filter((r) => legend.visible(seriesOf(r))),
      spec,
      xField,
      yField,
    );
    draw(false);
  });
  const tooltip = createTooltip(el);
  const ix = interactionsOf(ctx);
  let rows: Row[] = [];
  let allSeries: string[] = [];
  const seriesOf = (r: Row) => (spec.series ? String(r[spec.series]) : yField);

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
    // Colors come from all series, so hiding one does not change the others.
    const color = colors(theme, allSeries);
    const ms = animated ? motionMs(theme) : 0;

    const edges = look.edges ? edgesOf(categories) : undefined;
    const none = look.none;
    if (horizontal) renderAxes(layers, value as never, band as never, { w, h, fmt, valueAxis: "x", edges, none });
    else renderAxes(layers, band as never, value as never, { w, h, fmt, edges, right: look.right, none });

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
      .style("fill", (b) => color(b.series))
      .attr("opacity", (b) => dimOpacity(ix, xField, b.category))
      .call((s) => bindSelect(s, ix, xField, (b) => b.category))
      .call((s) => bindTooltip(s, tooltip, (b) => [b.category, `${b.series}: ${fmt(b.value)}`]))
      .call((s) => apply(animate(s, ms) as never, rect));

    legend.update(allSeries, color);
  }

  return {
    update(next) {
      const fixed = fixedCategories(spec);
      rows = fixed ? next.filter((r) => fixed.includes(String(r[xField]))) : next;
      allSeries = [...new Set(rows.map(seriesOf))].sort(byName);
      data = toBars(
        rows.filter((r) => legend.visible(seriesOf(r))),
        spec,
        xField,
        yField,
      );
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
