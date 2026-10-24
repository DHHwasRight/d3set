import * as d3 from "d3";
import type { Row } from "../data/types";
import type { ChartFactory } from "./types";
import { aggregate, createFrame, createLegend, margin, motionMs, seriesColor } from "./util";

interface Bar {
  category: string;
  series: string;
  value: number;
}

export const barChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  let rows: Row[] = [];
  const xField = spec.x ?? "x";
  const how = spec.aggregate ?? "sum";
  const frame = createFrame(el, spec.height ?? 240, () => draw(false));
  const legend = createLegend(el);
  const g = frame.svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const gridG = g.append("g");
  const xAxisG = g.append("g");
  const yAxisG = g.append("g");
  const barsG = g.append("g");
  const fmt = d3.format(spec.format ?? "~s");

  function toBars(): Bar[] {
    return d3
      .rollups(
        rows,
        (v) => aggregate(v.map((r) => Number(r[spec.y])), how),
        (r) => String(r[xField]),
        (r) => (spec.series ? String(r[spec.series]) : spec.y),
      )
      .flatMap(([category, inner]) => inner.map(([series, value]) => ({ category, series, value })));
  }

  function draw(animate = true) {
    const { w, h } = frame.inner();
    const bars = toBars();
    const categories = [...new Set(bars.map((b) => b.category))];
    const seriesKeys = [...new Set(bars.map((b) => b.series))];
    const x0 = d3.scaleBand().domain(categories).range([0, w]).paddingInner(0.2).paddingOuter(0.1);
    const x1 = d3.scaleBand().domain(seriesKeys).range([0, x0.bandwidth()]).padding(0.05);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(bars, (b) => b.value) ?? 1])
      .nice()
      .range([h, 0]);
    const color = seriesColor(theme, seriesKeys);
    const ms = animate ? motionMs(theme) : 0;

    xAxisG.attr("transform", `translate(0,${h})`).call(d3.axisBottom(x0).tickSizeOuter(0));
    yAxisG.call(d3.axisLeft(y).ticks(5).tickFormat((v) => fmt(v as number)));
    gridG.call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(() => "")).call((s) => s.select(".domain").remove());

    barsG
      .selectAll<SVGRectElement, Bar>("rect")
      .data(bars, (b) => `${b.category}\u0000${b.series}`)
      .join(
        (enter) =>
          enter
            .append("rect")
            // New bars grow from the baseline at their final position.
            .attr("x", (b) => (x0(b.category) ?? 0) + (x1(b.series) ?? 0))
            .attr("width", x1.bandwidth())
            .attr("y", h)
            .attr("height", 0)
            .call((s) => s.append("title")),
        (update) => update,
        (exit) => exit.transition().duration(ms).attr("y", h).attr("height", 0).remove(),
      )
      .attr("rx", Math.min(3, theme.radius))
      .attr("fill", (b) => color(b.series))
      .call((s) => s.select("title").text((b) => `${b.category} · ${b.series}: ${fmt(b.value)}`))
      .transition().duration(ms)
      .attr("x", (b) => (x0(b.category) ?? 0) + (x1(b.series) ?? 0))
      .attr("width", x1.bandwidth())
      .attr("y", (b) => y(Math.max(0, b.value)))
      .attr("height", (b) => Math.abs(y(b.value) - y(0)));

    legend.update(seriesKeys, color);
  }

  return {
    update(next) {
      rows = next;
      draw();
    },
    setTheme(next) {
      theme = next;
      draw(false);
    },
    destroy() {
      legend.destroy();
      frame.destroy();
    },
  };
};
