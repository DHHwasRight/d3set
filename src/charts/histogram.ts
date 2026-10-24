import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { bindTooltip, createFrame, createTooltip, createXYLayers, motionMs, need, renderAxes } from "./util";

/** Distribution of the numeric field `y` in `bins` buckets (default 20). */
export const histogramChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const yField = need(spec, "y");
  const fmt = d3.format(spec.format ?? ".3~s");
  let values: number[] = [];

  const frame = createFrame(el, spec.height ?? 240, () => draw(false));
  const layers = createXYLayers(frame);
  const tooltip = createTooltip(el);

  function draw(animate = true) {
    const { w, h } = frame.inner();
    const ext = d3.extent(values) as [number, number] | [undefined, undefined];
    const x = d3
      .scaleLinear()
      .domain(ext[0] === undefined ? [0, 1] : [ext[0], ext[1]!])
      .nice(spec.bins ?? 20)
      .range([0, w]);
    const bins = d3
      .bin()
      .domain(x.domain() as [number, number])
      .thresholds(x.ticks(spec.bins ?? 20))(values);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(bins, (b) => b.length) || 1])
      .nice()
      .range([h, 0]);
    renderAxes(layers, x as never, y as never, { w, h, fmt: d3.format("~s") });
    layers.xAxis.call(d3.axisBottom(x).ticks(Math.max(2, w / 80)).tickFormat((v) => fmt(v as number)).tickSizeOuter(0));

    layers.plot
      .selectAll<SVGRectElement, d3.Bin<number, number>>("rect")
      .data(bins)
      .join((enter) => enter.append("rect").attr("y", h).attr("height", 0))
      .attr("fill", "var(--d3s-accent)")
      .attr("x", (b) => x(b.x0!) + 1)
      .attr("width", (b) => Math.max(0, x(b.x1!) - x(b.x0!) - 1))
      .call((s) => bindTooltip(s, tooltip, (b) => [`${fmt(b.x0!)} – ${fmt(b.x1!)}`, `${b.length} rows`]))
      .transition()
      .duration(animate ? motionMs(theme) : 0)
      .attr("y", (b) => y(b.length))
      .attr("height", (b) => h - y(b.length));
  }

  return {
    update(rows) {
      values = rows.map((r) => Number(r[yField])).filter((v) => Number.isFinite(v));
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
