import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { aggregate, bindTooltip, createFrame, createTooltip, createXYLayers, margin, motionMs, need, renderAxes, sequentialColor } from "./util";

interface Cell {
  x: string;
  row: string;
  value: number;
}

/** A grid of `x` columns by `series` rows, colored by the aggregate of `y` (default `sum`). */
export const heatmapChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const rowField = need(spec, "series");
  const fmt = d3.format(spec.format ?? ".3~s");
  let cells: Cell[] = [];

  const frame = createFrame(el, spec.height ?? 240, () => draw(false), { ...margin, left: 72 });
  const layers = createXYLayers(frame);
  const tooltip = createTooltip(el);

  function draw(animate = true) {
    const { w, h } = frame.inner();
    const sortKeys = (keys: string[]) => keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const xs = sortKeys([...new Set(cells.map((c) => c.x))]);
    const rowsKeys = sortKeys([...new Set(cells.map((c) => c.row))]);
    const x = d3.scaleBand().domain(xs).range([0, w]).padding(0.04);
    const y = d3.scaleBand().domain(rowsKeys).range([0, h]).padding(0.04);
    const color = sequentialColor(theme, [d3.min(cells, (c) => c.value) ?? 0, d3.max(cells, (c) => c.value) ?? 1]);
    renderAxes(layers, x as never, y as never, { w, h, fmt, valueAxis: "x" });
    layers.grid.selectAll("*").remove();
    // Too many columns: show every n-th label.
    const every = Math.ceil(xs.length / Math.max(1, w / 48));
    layers.xAxis.selectAll<SVGGElement, string>(".tick").attr("opacity", (_, i) => (i % every === 0 ? 1 : 0));

    layers.plot
      .selectAll<SVGRectElement, Cell>("rect")
      .data(cells, (c) => `${c.x}\u0000${c.row}`)
      .join("rect")
      .attr("x", (c) => x(c.x) ?? 0)
      .attr("y", (c) => y(c.row) ?? 0)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("rx", Math.min(2, theme.radius))
      .call((s) => bindTooltip(s, tooltip, (c) => [`${c.row} · ${c.x}`, fmt(c.value)]))
      .transition()
      .duration(animate ? motionMs(theme) : 0)
      .attr("fill", (c) => color(c.value));
  }

  return {
    update(rows) {
      cells = d3
        .rollups(
          rows,
          (v) => aggregate(v.map((r) => Number(r[yField])), spec.aggregate ?? "sum"),
          (r) => String(r[xField]),
          (r) => String(r[rowField]),
        )
        .flatMap(([x, inner]) => inner.map(([row, value]) => ({ x, row, value })));
      draw();
    },
    setTheme(next) {
      theme = next;
      draw(false);
    },
    destroy() {
      tooltip.destroy();
      frame.destroy();
    },
  };
};
