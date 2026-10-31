import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { formatX, toSeriesData, xInteract, xScale, type SeriesData, type XValue } from "./xy";
import {
  tweenPath,
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
  xyLook,
  xyMargin,
} from "./util";

type Point = [XValue, number];

/**
 * Lines over a time or numeric x axis. One line per `series` value.
 * Drag to zoom (range filter on `x`), double-click to reset, click the legend to show or hide series.
 * `options.curve: "linear"` draws straight segments instead of `curveMonotoneX`.
 */
export const lineChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const colors = stableColors();
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const fmt = d3.format(spec.format ?? ".3~s");
  const look = xyLook(spec);
  const curve = spec.options?.curve === "linear" ? d3.curveLinear : d3.curveMonotoneX;
  let data: SeriesData = toSeriesData([], spec, xField, yField);
  let x = xScale(data, 1);

  const frame = createFrame(el, spec.height ?? 240, () => draw(false), xyMargin(spec));
  const layers = createXYLayers(frame);
  const legend = createLegend(el, () => draw(false));
  const tooltip = createTooltip(el);
  const linesG = layers.plot.append("g");
  const pointer = xInteract(layers.plot, {
    xs: () => data.xs,
    x: () => x,
    interactions: interactionsOf(ctx),
    field: xField,
    onHover(hx, event) {
      if (hx === undefined) return tooltip.hide();
      const vals = data.table.get(+hx)!;
      const keys = data.keys.filter((k) => legend.visible(k) && vals.has(k));
      tooltip.show(event, [formatX(hx), ...keys.map((k) => `${k}: ${fmt(vals.get(k)!)}`)]);
    },
  });

  function draw(animated = true) {
    const { w, h } = frame.inner();
    x = xScale(data, w);
    const keys = data.keys.filter(legend.visible);
    const all = [...data.table.values()].flatMap((m) => keys.filter((k) => m.has(k)).map((k) => m.get(k)!));
    const y = d3
      .scaleLinear()
      .domain([Math.min(0, d3.min(all) ?? 0), d3.max(all) ?? 1])
      .nice()
      .range([h, 0]);
    // Colors come from all keys, so hiding a series does not change the others.
    const color = colors(theme, data.keys);
    renderAxes(layers, x as never, y as never, {
      w,
      h,
      fmt,
      edges: look.edges ? edgesOf(data.xs) : undefined,
      right: look.right,
      none: look.none,
    });
    pointer.resize(w, h);

    // Drawn in pixels: the points animate one by one (tweenPath), keyed by their x.
    const line = d3
      .line<number[]>()
      .x((p) => p[0]!)
      .y((p) => p[1]!)
      .curve(curve);
    const series = keys.map(
      (k) =>
        [
          k,
          data.xs.filter((xv) => data.table.get(+xv)!.has(k)).map((xv) => [xv, data.table.get(+xv)!.get(k)!] as Point),
        ] as const,
    );

    linesG
      .selectAll<SVGPathElement, (typeof series)[number]>("path")
      .data(series, (d) => d[0])
      .join("path")
      .attr("stroke-width", 2)
      // In `style`, like the stroke and like the Rust renderer's path: the first frame is the same.
      .style("fill", "none")
      .style("stroke", ([k]) => color(k))
      .call((s) =>
        tweenPath(
          s,
          animated ? motionMs(theme) : 0,
          ([, pts]) => (pts as Point[]).map((p) => ({ key: +p[0], at: [x(p[0] as never), y(p[1])] })),
          (at) => line(at),
        ),
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
