import * as d3 from "d3";
import type { ChartFactory } from "./types";
import {
  animate,
  bindSelect,
  bindTooltip,
  createFrame,
  createTooltip,
  dimOpacity,
  interactionsOf,
  motionMs,
  need,
  rollup,
  stableColors,
  textOn,
} from "./util";

interface Stage {
  name: string;
  value: number;
  /** Share of the first stage. */
  ofFirst: number;
  /** Share of the stage before. */
  ofPrev: number;
}

/**
 * Stages of a process, widest first: value `y` per stage `x` (default aggregate `sum`).
 * Stages keep their first-seen order. Set `options.sort: true` to sort them by value.
 */
export const funnelChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const colors = stableColors();
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const fmt = d3.format(spec.format ?? ".3~s");
  const pct = d3.format(".1%");
  let stages: Stage[] = [];

  const frame = createFrame(el, spec.height ?? 240, () => draw(false), { top: 4, right: 4, bottom: 4, left: 4 });
  const g = frame.svg.append("g");
  const tooltip = createTooltip(el);
  const ix = interactionsOf(ctx);

  function draw(animated = true) {
    const { w, h } = frame.inner();
    g.attr("transform", `translate(${frame.margin.left},${frame.margin.top})`);
    const band = d3
      .scaleBand()
      .domain(stages.map((s) => s.name))
      .range([0, h])
      .padding(0.12);
    const width = d3
      .scaleLinear()
      .domain([0, d3.max(stages, (s) => s.value) || 1])
      .range([0, w]);
    const color = colors(
      theme,
      stages.map((s) => s.name),
    );
    const ms = animated ? motionMs(theme) : 0;

    const row = g
      .selectAll<SVGGElement, Stage>("g.d3s-stage")
      .data(stages, (s) => s.name)
      .join((enter) => {
        const e = enter.append("g").attr("class", "d3s-stage");
        e.append("rect")
          .attr("x", w / 2)
          .attr("width", 0);
        e.append("text").attr("class", "d3s-label").attr("text-anchor", "middle").attr("dy", "0.35em");
        return e;
      })
      .call((s) =>
        bindTooltip(s, tooltip, (st) => [
          st.name,
          fmt(st.value),
          `${pct(st.ofFirst)} of first`,
          `${pct(st.ofPrev)} of previous`,
        ]),
      );
    row
      .attr("transform", (s) => `translate(0,${band(s.name) ?? 0})`)
      .attr("opacity", (s) => dimOpacity(ix, xField, s.name))
      .call((s) => bindSelect(s, ix, xField, (st) => st.name));
    row
      .select("rect")
      .attr("height", band.bandwidth())
      .attr("rx", Math.min(4, theme.radius))
      .style("fill", (s) => color(s.name))
      .call((s) =>
        animate(s, ms)
          .attr("x", (s) => (w - width(s.value)) / 2)
          .attr("width", (s) => width(s.value)),
      );
    row
      .select("text")
      .attr("x", w / 2)
      .attr("y", band.bandwidth() / 2)
      .style("fill", (s) => textOn(theme, color(s.name)))
      .text((s) => `${s.name} · ${fmt(s.value)} · ${pct(s.ofFirst)}`);
  }

  return {
    update(rows) {
      let entries = rollup(rows, (r) => String(r[xField]), yField, spec.aggregate ?? "sum");
      if (spec.options?.sort) entries = entries.sort((a, b) => b[1] - a[1]);
      const first = entries[0]?.[1] ?? 0;
      stages = entries.map(([name, value], i) => {
        const prev = i === 0 ? value : entries[i - 1]![1];
        return { name, value, ofFirst: first ? value / first : 0, ofPrev: prev ? value / prev : 0 };
      });
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
