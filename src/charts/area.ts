import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { formatX, toSeriesData, xHover, xScale, type SeriesData, type XValue } from "./xy";
import { createFrame, createLegend, createTooltip, createXYLayers, motionMs, need, renderAxes, seriesColor } from "./util";

interface Band {
  key: string;
  points: Array<{ x: XValue; y0: number; y1: number }>;
}

/** Filled areas over a time or numeric x axis. Stacked by default (`stacked: false` overlaps them). */
export const areaChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const stacked = spec.stacked ?? true;
  const fmt = d3.format(spec.format ?? ".3~s");
  let data: SeriesData = toSeriesData([], spec, xField, yField);
  let x = xScale(data, 1);

  const frame = createFrame(el, spec.height ?? 240, () => draw(false));
  const layers = createXYLayers(frame);
  const legend = createLegend(el);
  const tooltip = createTooltip(el);
  const areasG = layers.plot.append("g");
  const hover = xHover(
    layers.plot,
    () => data.xs,
    (px) => +x.invert(px),
    (hx, event) => {
      if (hx === undefined) return tooltip.hide();
      hover.moveRule(x(hx as never));
      const vals = data.table.get(+hx)!;
      const lines = data.keys.map((k) => `${k}: ${fmt(vals.get(k) ?? 0)}`);
      if (stacked && data.keys.length > 1) lines.push(`Total: ${fmt(d3.sum(vals.values()))}`);
      tooltip.show(event, [formatX(hx), ...lines]);
    },
  );

  function draw(animate = true) {
    const { w, h } = frame.inner();
    x = xScale(data, w);
    // Missing points count as 0 so stacks stay continuous.
    const wide = data.xs.map((xv) => {
      const vals = data.table.get(+xv)!;
      return Object.fromEntries(data.keys.map((k) => [k, vals.get(k) ?? 0])) as Record<string, number>;
    });
    const bands: Band[] = stacked
      ? d3
          .stack<Record<string, number>>()
          .keys(data.keys)(wide)
          .map((s) => ({ key: s.key, points: s.map((p, i) => ({ x: data.xs[i]!, y0: p[0], y1: p[1] })) }))
      : data.keys.map((k) => ({ key: k, points: wide.map((d, i) => ({ x: data.xs[i]!, y0: 0, y1: d[k] ?? 0 })) }));
    const top = d3.max(bands, (b) => d3.max(b.points, (p) => p.y1)) ?? 1;
    const y = d3.scaleLinear().domain([0, top || 1]).nice().range([h, 0]);
    const color = seriesColor(theme, data.keys);
    renderAxes(layers, x as never, y as never, { w, h, fmt });
    hover.resize(w, h);

    const area = d3
      .area<Band["points"][number]>()
      .x((p) => x(p.x as never))
      .y0((p) => y(p.y0))
      .y1((p) => y(p.y1))
      .curve(d3.curveMonotoneX);

    areasG
      .selectAll<SVGPathElement, Band>("path")
      .data(bands, (d) => d.key)
      .join("path")
      .attr("fill", (d) => color(d.key))
      .attr("fill-opacity", stacked ? 0.85 : 0.35)
      .attr("stroke", (d) => color(d.key))
      .attr("stroke-width", stacked ? 0 : 1.5)
      .transition()
      .duration(animate ? motionMs(theme) : 0)
      .attr("d", (d) => area(d.points));

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
