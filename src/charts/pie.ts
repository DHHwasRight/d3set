import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { bindTooltip, createFrame, createLegend, createTooltip, motionMs, need, rollup, seriesColor, topN } from "./util";

type Slice = d3.PieArcDatum<[string, number]>;

/**
 * Share of a total by category (`x`), value `y` (default aggregate `sum`).
 * `innerRadius` (0 to 0.9) makes a donut. `limit` groups small slices into "Other".
 */
export const pieChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const fmt = d3.format(spec.format ?? ".3~s");
  const pct = d3.format(".1%");
  let entries: Array<[string, number]> = [];

  const frame = createFrame(el, spec.height ?? 240, () => draw(false), { top: 4, right: 4, bottom: 4, left: 4 });
  const g = frame.svg.append("g");
  const legend = createLegend(el);
  const tooltip = createTooltip(el);
  let previous = new Map<string, Slice>();

  function draw(animate = true) {
    const { w, h } = frame.inner();
    const r = Math.max(0, Math.min(w, h) / 2);
    g.attr("transform", `translate(${frame.margin.left + w / 2},${frame.margin.top + h / 2})`);
    const total = d3.sum(entries, (e) => e[1]);
    const slices = d3
      .pie<[string, number]>()
      .sort(null)
      .value((e) => Math.max(0, e[1]))(entries);
    const arc = d3
      .arc<Slice>()
      .innerRadius(r * Math.min(0.9, Math.max(0, spec.innerRadius ?? 0)))
      .outerRadius(r)
      .padAngle(0.01)
      .cornerRadius(Math.min(2, theme.radius));
    const color = seriesColor(theme, entries.map((e) => e[0]));

    // Slices tween from their previous angles, so live updates do not jump.
    const prev = previous;
    g.selectAll<SVGPathElement, Slice>("path")
      .data(slices, (s) => s.data[0])
      .join("path")
      .attr("fill", (s) => color(s.data[0]))
      .attr("stroke", "var(--d3s-surface)")
      .attr("stroke-width", 1)
      .call((sel) => bindTooltip(sel, tooltip, (s) => [s.data[0], `${fmt(s.data[1])} (${pct(total ? s.data[1] / total : 0)})`]))
      .transition()
      .duration(animate ? motionMs(theme) : 0)
      .attrTween("d", function (s) {
        const start = prev.get(s.data[0]) ?? { ...s, startAngle: s.endAngle };
        const i = d3.interpolate(start, s);
        return (t) => arc(i(t)) ?? "";
      });
    previous = new Map(slices.map((s) => [s.data[0], s]));

    legend.update(
      entries.map((e) => e[0]),
      color,
      true,
    );
  }

  return {
    update(rows) {
      entries = topN(rollup(rows, (r) => String(r[xField]), yField, spec.aggregate ?? "sum"), spec.limit);
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

export const donutChart: ChartFactory = (el, spec, ctx) => pieChart(el, { innerRadius: 0.6, ...spec }, ctx);
