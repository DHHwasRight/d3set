import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { formatX, toSeriesData, xHover, xScale, type SeriesData, type XValue } from "./xy";
import {
  createFrame,
  createLegend,
  createTooltip,
  createXYLayers,
  motionMs,
  need,
  renderAxes,
  renderMarkers,
  seriesColor,
  animate,
} from "./util";

type Point = [XValue, number];

/** Lines over a time or numeric x axis. One line per `series` value. */
export const lineChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const fmt = d3.format(spec.format ?? ".3~s");
  let data: SeriesData = toSeriesData([], spec, xField, yField);
  let x = xScale(data, 1);

  const frame = createFrame(el, spec.height ?? 240, () => draw(false));
  const layers = createXYLayers(frame);
  const legend = createLegend(el);
  const tooltip = createTooltip(el);
  const hover = xHover(
    layers.plot,
    () => data.xs,
    (px) => +x.invert(px),
    (hx, event) => {
      if (hx === undefined) return tooltip.hide();
      hover.moveRule(x(hx as never));
      const vals = data.table.get(+hx)!;
      tooltip.show(event, [
        formatX(hx),
        ...data.keys.filter((k) => vals.has(k)).map((k) => `${k}: ${fmt(vals.get(k)!)}`),
      ]);
    },
  );
  const linesG = layers.plot.append("g");

  function draw(animated = true) {
    const { w, h } = frame.inner();
    x = xScale(data, w);
    const all = [...data.table.values()].flatMap((m) => [...m.values()]);
    const y = d3
      .scaleLinear()
      .domain([Math.min(0, d3.min(all) ?? 0), d3.max(all) ?? 1])
      .nice()
      .range([h, 0]);
    const color = seriesColor(theme, data.keys);
    renderAxes(layers, x as never, y as never, { w, h, fmt });
    hover.resize(w, h);

    const line = d3
      .line<Point>()
      .x((p) => x(p[0] as never))
      .y((p) => y(p[1]))
      .curve(d3.curveMonotoneX);
    const series = data.keys.map(
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
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("stroke", ([k]) => color(k))
      .call((s) => animate(s, animated ? motionMs(theme) : 0).attr("d", ([, pts]) => line(pts as Point[])));

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
      tooltip.destroy();
      legend.destroy();
      frame.destroy();
    },
  };
};
