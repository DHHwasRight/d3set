import * as d3 from "d3";
import type { Row } from "../data/types";
import type { ChartFactory } from "./types";
import {
  asDate,
  bindTooltip,
  createFrame,
  createLegend,
  createTooltip,
  createXYLayers,
  motionMs,
  need,
  renderAxes,
  seriesColor,
} from "./util";

interface Dot {
  i: number;
  x: number | Date;
  y: number;
  size: number;
  series: string;
}

/** One dot per row. `size` makes a bubble chart. `series` colors the dots. `limit` keeps the last N rows (default 2000). */
export const scatterChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const fmt = d3.format(spec.format ?? ".3~s");
  let dots: Dot[] = [];

  const frame = createFrame(el, spec.height ?? 240, () => draw(false));
  const layers = createXYLayers(frame);
  const legend = createLegend(el);
  const tooltip = createTooltip(el);

  // Stable dot ids, so a sliding window of rows does not move the dots that stay.
  const ids = new WeakMap<Row, number>();
  let nextId = 0;
  const idOf = (r: Row) => {
    let id = ids.get(r);
    if (id === undefined) ids.set(r, (id = nextId++));
    return id;
  };

  function toDots(rows: Row[]): Dot[] {
    const tail = rows.slice(-(spec.limit ?? 2000));
    return tail
      .map((r) => ({
        i: idOf(r),
        x: asDate(r[xField]) ?? Number(r[xField]),
        y: Number(r[yField]),
        size: spec.size ? Number(r[spec.size]) : 1,
        series: spec.series ? String(r[spec.series]) : yField,
      }))
      .filter((d) => !Number.isNaN(+d.x) && !Number.isNaN(d.y));
  }

  function draw(animate = true) {
    const { w, h } = frame.inner();
    const isTime = dots[0]?.x instanceof Date;
    const xExt = (d3.extent(dots, (d) => +d.x) as [number, number]) ?? [0, 1];
    const x = isTime
      ? d3.scaleTime().domain(xExt.map((v) => new Date(v ?? 0)) as [Date, Date]).range([0, w]).nice()
      : d3.scaleLinear().domain(xExt[0] === undefined ? [0, 1] : xExt).range([0, w]).nice();
    const y = d3
      .scaleLinear()
      .domain(d3.extent(dots, (d) => d.y).map((v) => v ?? 0) as [number, number])
      .nice()
      .range([h, 0]);
    const r = spec.size
      ? d3
          .scaleSqrt()
          .domain([0, d3.max(dots, (d) => d.size) ?? 1])
          .range([2, Math.max(6, Math.min(w, h) / 12)])
      : () => 3.5;
    const keys = [...new Set(dots.map((d) => d.series))];
    const color = seriesColor(theme, keys);
    renderAxes(layers, x as never, y as never, { w, h, fmt });

    layers.plot
      .selectAll<SVGCircleElement, Dot>("circle")
      .data(dots, (d) => String(d.i))
      .join((enter) => enter.append("circle").attr("r", 0))
      .attr("fill", (d) => color(d.series))
      .attr("fill-opacity", spec.size ? 0.55 : 0.75)
      .attr("stroke", (d) => color(d.series))
      .call((s) =>
        bindTooltip(s, tooltip, (d) => [
          d.series,
          `${xField}: ${d.x instanceof Date ? d3.timeFormat("%Y-%m-%d %H:%M")(d.x) : fmt(d.x)}`,
          `${yField}: ${fmt(d.y)}`,
          ...(spec.size ? [`${spec.size}: ${fmt(d.size)}`] : []),
        ]),
      )
      .transition()
      .duration(animate ? motionMs(theme) : 0)
      .attr("cx", (d) => x(d.x as never))
      .attr("cy", (d) => y(d.y))
      .attr("r", (d) => r(d.size));

    legend.update(keys, color);
  }

  return {
    update(rows) {
      dots = toDots(rows);
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
