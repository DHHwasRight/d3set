import * as d3 from "d3";
import { areaChart } from "./area";
import { lineChart } from "./line";
import type { ChartFactory } from "./types";
import { formatX, toSeriesData, xInteract, xScale, type SeriesData } from "./xy";
import {
  createFrame,
  createLegend,
  createTooltip,
  createXYLayers,
  edgesOf,
  interactionsOf,
  motionMs,
  need,
  renderAxes,
  renderMarkers,
  stableColors,
  animate,
  xyLook,
  xyMargin,
} from "./util";

interface TimeBar {
  key: string;
  x: number;
  y0: number;
  y1: number;
  value: number;
}

/** Stacked bars per time bucket. Used by `timeseries` with `display: "bars"`. */
const timeBarsChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const colors = stableColors();
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const fmt = d3.format(spec.format ?? ".3~s");
  const look = xyLook(spec);
  let data: SeriesData = toSeriesData([], spec, xField, yField);
  let x = xScale(data, 1);

  const frame = createFrame(el, spec.height ?? 240, () => draw(false), xyMargin(spec));
  const layers = createXYLayers(frame);
  const legend = createLegend(el, () => draw(false));
  const tooltip = createTooltip(el);
  const barsG = layers.plot.append("g");
  const pointer = xInteract(layers.plot, {
    xs: () => data.xs,
    x: () => x,
    // Bars start at the bucket start: snap to the bucket under the pointer, rule at its middle.
    offset: () => (data.step ?? 0) / 2,
    interactions: interactionsOf(ctx),
    field: xField,
    onHover(hx, event) {
      if (hx === undefined) return tooltip.hide();
      const vals = data.table.get(+hx)!;
      const keys = data.keys.filter((k) => legend.visible(k) && vals.has(k));
      const lines = keys.map((k) => `${k}: ${fmt(vals.get(k)!)}`);
      if (keys.length > 1) lines.push(`Total: ${fmt(d3.sum(keys, (k) => vals.get(k)!))}`);
      tooltip.show(event, [formatX(hx), ...lines]);
    },
  });

  function draw(animated = true) {
    const { w, h } = frame.inner();
    x = xScale(data, w);
    // Bar width: the bucket length, else the smallest gap between x values.
    const gaps = d3.pairs(data.xs, (a, b) => +b - +a);
    const step = data.step ?? d3.min(gaps) ?? 1;
    const bw = Math.max(1, x((+data.xs[0]! + step) as never) - x(data.xs[0] as never) - 1);

    const keys = data.keys.filter(legend.visible);
    const wide = data.xs.map(
      (xv) => Object.fromEntries(keys.map((k) => [k, data.table.get(+xv)!.get(k) ?? 0])) as Record<string, number>,
    );
    const bars: TimeBar[] = d3
      .stack<Record<string, number>>()
      .keys(keys)
      .offset(d3.stackOffsetDiverging)(wide)
      .flatMap((layer) =>
        layer.map((p, i) => ({ key: layer.key, x: +data.xs[i]!, y0: p[0], y1: p[1], value: p.data[layer.key] ?? 0 })),
      );

    const y = d3
      .scaleLinear()
      .domain([Math.min(0, d3.min(bars, (b) => b.y0) ?? 0), Math.max(0, d3.max(bars, (b) => b.y1) ?? 1) || 1])
      .nice()
      .range([h, 0]);
    const color = colors(theme, data.keys);
    const ms = animated ? motionMs(theme) : 0;
    renderAxes(layers, x as never, y as never, {
      w,
      h,
      fmt,
      edges: look.edges ? edgesOf(data.xs) : undefined,
      right: look.right,
      none: look.none,
    });
    pointer.resize(w, h);

    barsG
      .selectAll<SVGRectElement, TimeBar>("rect")
      .data(bars, (b) => `${b.key}\u0000${b.x}`)
      .join((enter) =>
        enter
          .append("rect")
          .attr("x", (b) => x(b.x as never))
          .attr("y", y(0))
          .attr("height", 0),
      )
      .style("fill", (b) => color(b.key))
      .call((s) =>
        animate(s, ms)
          .attr("x", (b) => x(b.x as never))
          .attr("width", bw)
          .attr("y", (b) => y(b.y1))
          .attr("height", (b) => Math.max(0, y(b.y0) - y(b.y1))),
      );

    renderMarkers(layers.plot, y, w, theme, spec.thresholds, fmt);
    legend.update(data.keys, color);
  }

  return {
    update(rows) {
      data = toSeriesData(rows, spec, xField, yField);
      draw();
    },
    setTheme(next) {
      theme = next;
      draw(false);
    },
    destroy() {
      pointer.destroy();
      tooltip.destroy();
      legend.destroy();
      frame.destroy();
    },
  };
};

/**
 * The Datadog-style time series: values of `y` over time `x`, split by `series`.
 * Defaults: `interval: "auto"`, `aggregate: "sum"`, `display: "line"`.
 * `thresholds` draw marker lines.
 */
export const timeseriesChart: ChartFactory = (el, spec, ctx) => {
  const full = { interval: "auto", aggregate: "sum" as const, ...spec };
  switch (spec.display ?? "line") {
    case "line":
      return lineChart(el, full, ctx);
    case "area":
      return areaChart(el, full, ctx);
    case "bars":
      return timeBarsChart(el, full, ctx);
  }
};
