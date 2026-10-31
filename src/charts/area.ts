import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { formatX, toSeriesData, xInteract, xScale, type SeriesData, type XValue } from "./xy";
import {
  createFrame,
  createLegend,
  createTooltip,
  createXYLayers,
  edgesOf,
  gradientId,
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

interface Band {
  key: string;
  points: Array<{ x: XValue; y0: number; y1: number }>;
}

/**
 * Filled areas over a time or numeric x axis. Stacked by default (`stacked: false` overlaps them).
 * `options.curve: "linear"` draws straight segments. `options.gradient: true` fills each area with a
 * vertical gradient of its color (opacity 0.4 at the top to 0 at 60%), not stroked, and a 2px line
 * (`path.d3s-area-line`) draws only its top edge, in a group after the areas.
 */
export const areaChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const colors = stableColors();
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const stacked = spec.stacked ?? true;
  const fmt = d3.format(spec.format ?? ".3~s");
  const look = xyLook(spec);
  const curve = spec.options?.curve === "linear" ? d3.curveLinear : d3.curveMonotoneX;
  const gradient = spec.options?.gradient === true;
  let data: SeriesData = toSeriesData([], spec, xField, yField);
  let x = xScale(data, 1);

  const frame = createFrame(el, spec.height ?? 240, () => draw(false), xyMargin(spec));
  const layers = createXYLayers(frame);
  const legend = createLegend(el, () => draw(false));
  const tooltip = createTooltip(el);
  // Gradients first in the plot, where the server renderer puts them too.
  const defs = gradient ? layers.plot.append("defs") : undefined;
  const areasG = layers.plot.append("g");
  const linesG = gradient ? layers.plot.append("g") : undefined;
  const pointer = xInteract(layers.plot, {
    xs: () => data.xs,
    x: () => x,
    interactions: interactionsOf(ctx),
    field: xField,
    onHover(hx, event) {
      if (hx === undefined) return tooltip.hide();
      const vals = data.table.get(+hx)!;
      const keys = data.keys.filter(legend.visible);
      const lines = keys.map((k) => `${k}: ${fmt(vals.get(k) ?? 0)}`);
      if (stacked && keys.length > 1) lines.push(`Total: ${fmt(d3.sum(keys, (k) => vals.get(k) ?? 0))}`);
      tooltip.show(event, [formatX(hx), ...lines]);
    },
  });

  function draw(animated = true) {
    const { w, h } = frame.inner();
    x = xScale(data, w);
    const keys = data.keys.filter(legend.visible);
    // Missing points count as 0 so stacks stay continuous.
    const wide = data.xs.map((xv) => {
      const vals = data.table.get(+xv)!;
      return Object.fromEntries(keys.map((k) => [k, vals.get(k) ?? 0])) as Record<string, number>;
    });
    const bands: Band[] = stacked
      ? d3
          .stack<Record<string, number>>()
          .keys(keys)(wide)
          .map((s) => ({ key: s.key, points: s.map((p, i) => ({ x: data.xs[i]!, y0: p[0], y1: p[1] })) }))
      : keys.map((k) => ({ key: k, points: wide.map((d, i) => ({ x: data.xs[i]!, y0: 0, y1: d[k] ?? 0 })) }));
    const top = d3.max(bands, (b) => d3.max(b.points, (p) => p.y1)) ?? 1;
    const y = d3
      .scaleLinear()
      .domain([0, top || 1])
      .nice()
      .range([h, 0]);
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

    const area = d3
      .area<Band["points"][number]>()
      .x((p) => x(p.x as never))
      .y0((p) => y(p.y0))
      .y1((p) => y(p.y1))
      .curve(curve);

    // Gradient ids follow the series index among all keys, so hiding a series does not change them.
    const fillId = (k: string) => gradientId(spec, data.keys.indexOf(k));
    defs
      ?.selectAll<SVGLinearGradientElement, Band>("linearGradient")
      .data(bands, (d) => d.key)
      .join((enter) => {
        const g = enter.append("linearGradient").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
        g.append("stop").attr("offset", "0%").attr("stop-opacity", 0.4);
        g.append("stop").attr("offset", "60%").attr("stop-opacity", 0);
        return g;
      })
      .attr("id", (d) => fillId(d.key))
      .each(function (d) {
        d3.select(this).selectAll("stop").style("stop-color", color(d.key));
      });

    areasG
      .selectAll<SVGPathElement, Band>("path")
      .data(bands, (d) => d.key)
      .join("path")
      .style("fill", (d) => (gradient ? `url(#${fillId(d.key)})` : color(d.key)))
      .attr("fill-opacity", gradient ? null : stacked ? 0.85 : 0.35)
      .style("stroke", (d) => (gradient ? "none" : color(d.key)))
      .attr("stroke-width", gradient ? null : stacked ? 0 : 1.5)
      .call((s) => animate(s, animated ? motionMs(theme) : 0).attr("d", (d) => area(d.points)));

    // Gradient mode: the outline is only the top edge of each area, with the same curve.
    const topLine = d3
      .line<Band["points"][number]>()
      .x((p) => x(p.x as never))
      .y((p) => y(p.y1))
      .curve(curve);
    linesG
      ?.selectAll<SVGPathElement, Band>("path")
      .data(bands, (d) => d.key)
      .join("path")
      .attr("class", "d3s-area-line")
      .style("fill", "none")
      .style("stroke", (d) => color(d.key))
      .attr("stroke-width", 2)
      .call((s) => animate(s, animated ? motionMs(theme) : 0).attr("d", (d) => topLine(d.points)));

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
