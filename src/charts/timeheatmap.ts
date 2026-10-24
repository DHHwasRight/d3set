import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { autoInterval } from "./xy";
import {
  animate,
  asDate,
  bucket,
  createFrame,
  createTooltip,
  createXYLayers,
  interactionsOf,
  motionMs,
  need,
  parseInterval,
  rangeBrush,
  renderAxes,
  sequentialColor,
} from "./util";

interface Cell {
  t: number;
  lo: number;
  hi: number;
  count: number;
}

/**
 * Datadog-style heatmap: how the values of `y` spread over time.
 * Columns are time buckets of `x` (`interval`, default `auto` for about 40 columns),
 * rows are `bins` value ranges (default 12), and the color is the row count.
 */
export const timeheatmapChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const fmt = d3.format(spec.format ?? ".3~s");
  let cells: Cell[] = [];
  let step = 60_000;
  let yDomain: [number, number] = [0, 1];

  const frame = createFrame(el, spec.height ?? 240, () => draw(false));
  const layers = createXYLayers(frame);
  const tooltip = createTooltip(el);
  const cellsG = layers.plot.append("g");
  let x = d3.scaleTime();
  let y = d3.scaleLinear();
  // Drag to zoom the dashboard to a time range; double-click to reset. Hover goes through the brush layer.
  const brush = rangeBrush(layers.plot, { mode: "x", x: () => x, xField, interactions: interactionsOf(ctx) });
  brush.g
    .on("pointermove.d3s", (event: PointerEvent) => {
      const [px, py] = d3.pointer(event);
      const t = +x.invert(px);
      const v = y.invert(py);
      const c = cells.find((c) => t >= c.t && t < c.t + step && v >= c.lo && v < c.hi);
      if (!c) return tooltip.hide();
      tooltip.show(event, [d3.timeFormat("%H:%M:%S")(new Date(c.t)), `${fmt(c.lo)} – ${fmt(c.hi)}`, `${c.count} rows`]);
    })
    .on("pointerleave.d3s", () => tooltip.hide());

  function draw(animated = true) {
    const { w, h } = frame.inner();
    const tExt = d3.extent(cells, (c) => c.t) as [number, number] | [undefined, undefined];
    x = d3
      .scaleTime()
      .domain(tExt[0] === undefined ? [new Date(0), new Date(step)] : [new Date(tExt[0]), new Date(tExt[1]! + step)])
      .range([0, w]);
    y = d3.scaleLinear().domain(yDomain).range([h, 0]);
    const color = sequentialColor(theme, [0, d3.max(cells, (c) => c.count) ?? 1]);
    renderAxes(layers, x as never, y as never, { w, h, fmt });
    layers.grid.selectAll("*").remove();

    brush.resize(w, h);
    cellsG
      .selectAll<SVGRectElement, Cell>("rect")
      .data(cells, (c) => `${c.t}\u0000${c.lo}`)
      .join("rect")
      .attr("x", (c) => x(new Date(c.t)))
      .attr("width", (c) => Math.max(1, x(new Date(c.t + step)) - x(new Date(c.t)) - 1))
      .attr("y", (c) => y(c.hi))
      .attr("height", (c) => Math.max(1, y(c.lo) - y(c.hi) - 1))
      .call((s) => animate(s, animated ? motionMs(theme) : 0).attr("fill", (c) => color(c.count)));
  }

  return {
    update(rows) {
      step = spec.interval && spec.interval !== "auto" ? parseInterval(spec.interval) : autoInterval(rows, xField, 40);
      const points = rows
        .map((r) => ({ t: asDate(r[xField]), v: Number(r[yField]) }))
        .filter((p): p is { t: Date; v: number } => p.t !== undefined && Number.isFinite(p.v));
      const ext = d3.extent(points, (p) => p.v) as [number, number] | [undefined, undefined];
      const yScale = d3
        .scaleLinear()
        .domain(ext[0] === undefined ? [0, 1] : [ext[0], ext[1]!])
        .nice(spec.bins ?? 12);
      yDomain = yScale.domain() as [number, number];
      const thresholds = yScale.ticks(spec.bins ?? 12);
      const binOf = d3.bin().domain(yDomain).thresholds(thresholds);
      cells = d3
        .groups(points, (p) => +bucket(p.t, step))
        .flatMap(([t, list]) =>
          binOf(list.map((p) => p.v))
            .filter((b) => b.length > 0)
            .map((b) => ({ t, lo: b.x0!, hi: b.x1!, count: b.length })),
        );
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
