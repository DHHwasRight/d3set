import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { aggregate, createFrame, motionMs, need } from "./util";

/** A half-circle gauge of the aggregate of `y` (default `sum`) between `min` (default 0) and `max` (default 100). */
export const gaugeChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const yField = need(spec, "y");
  const min = spec.min ?? 0;
  const max = spec.max ?? 100;
  const fmt = d3.format(spec.format ?? ",.0f");
  let value = min;
  let shown = min;

  const frame = createFrame(el, spec.height ?? 160, () => draw(false), { top: 8, right: 8, bottom: 8, left: 8 });
  const g = frame.svg.append("g");
  const track = g.append("path").attr("fill", "var(--d3s-grid)");
  const bar = g.append("path");
  const label = g.append("text").attr("class", "d3s-label").attr("text-anchor", "middle");
  const lowLabel = g.append("text").attr("class", "d3s-label-muted").attr("text-anchor", "middle");
  const highLabel = g.append("text").attr("class", "d3s-label-muted").attr("text-anchor", "middle");

  function draw(animate = true) {
    const { w, h } = frame.inner();
    const r = Math.max(0, Math.min(w / 2, h - 16));
    g.attr("transform", `translate(${frame.margin.left + w / 2},${frame.margin.top + r})`);
    const angle = d3.scaleLinear().domain([min, max]).range([-Math.PI / 2, Math.PI / 2]).clamp(true);
    const arc = d3.arc<{ endAngle: number }>().innerRadius(r * 0.72).outerRadius(r).startAngle(-Math.PI / 2).cornerRadius(Math.min(4, theme.radius));
    const color = d3.interpolateLab(...theme.color.sequential);

    track.attr("d", arc({ endAngle: Math.PI / 2 }));
    const from = shown;
    bar
      .transition()
      .duration(animate ? motionMs(theme) : 0)
      .attrTween("d", () => {
        const i = d3.interpolateNumber(from, value);
        return (t) => {
          shown = i(t);
          return arc({ endAngle: angle(shown) }) ?? "";
        };
      })
      .attr("fill", color(0.35 + 0.65 * ((angle(value) + Math.PI / 2) / Math.PI)));
    label
      .attr("y", -r * 0.12)
      .style("font-size", `${Math.max(14, r * 0.32)}px`)
      .style("font-weight", 600)
      .text(fmt(value));
    lowLabel.attr("x", -r * 0.86).attr("y", 14).text(fmt(min));
    highLabel.attr("x", r * 0.86).attr("y", 14).text(fmt(max));
  }

  return {
    update(rows) {
      value = aggregate(rows.map((r) => Number(r[yField])), spec.aggregate ?? "sum");
      draw();
    },
    setTheme(next) {
      theme = next;
      draw(false);
    },
    destroy: () => frame.destroy(),
  };
};
