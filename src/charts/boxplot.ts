import * as d3 from "d3";
import type { ChartFactory } from "./types";
import {
  animate,
  bindSelect,
  bindTooltip,
  byName,
  createFrame,
  createTooltip,
  createXYLayers,
  dimOpacity,
  interactionsOf,
  motionMs,
  need,
  renderAxes,
  stableColors,
  tweenTranslate,
} from "./util";

interface Box {
  category: string;
  q1: number;
  median: number;
  q3: number;
  /** Whiskers: the furthest values within 1.5 × IQR. */
  lo: number;
  hi: number;
  outliers: number[];
  n: number;
}

/** Distribution of `y` per category `x`: quartiles, whiskers at 1.5 × IQR, and outlier dots. */
export const boxplotChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const colors = stableColors();
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const fmt = d3.format(spec.format ?? ".3~s");
  let boxes: Box[] = [];

  const frame = createFrame(el, spec.height ?? 240, () => draw(false));
  const layers = createXYLayers(frame);
  const tooltip = createTooltip(el);
  const ix = interactionsOf(ctx);

  function toBox(category: string, values: number[]): Box {
    const v = values.slice().sort(d3.ascending);
    const q1 = d3.quantileSorted(v, 0.25) ?? 0;
    const median = d3.quantileSorted(v, 0.5) ?? 0;
    const q3 = d3.quantileSorted(v, 0.75) ?? 0;
    const iqr = q3 - q1;
    const inside = v.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
    return {
      category,
      q1,
      median,
      q3,
      lo: inside[0] ?? q1,
      hi: inside.at(-1) ?? q3,
      outliers: v.filter((x) => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr),
      n: v.length,
    };
  }

  function draw(animated = true) {
    const { w, h } = frame.inner();
    const x = d3
      .scaleBand()
      .domain(boxes.map((b) => b.category))
      .range([0, w])
      .padding(0.4);
    const lo = d3.min(boxes, (b) => Math.min(b.lo, ...b.outliers)) ?? 0;
    const hi = d3.max(boxes, (b) => Math.max(b.hi, ...b.outliers)) ?? 1;
    const y = d3.scaleLinear().domain([lo, hi]).nice().range([h, 0]);
    const color = colors(
      theme,
      boxes.map((b) => b.category),
    );
    const ms = animated ? motionMs(theme) : 0;
    renderAxes(layers, x as never, y as never, { w, h, fmt });

    const g = layers.plot
      .selectAll<SVGGElement, Box>("g.d3s-box")
      .data(boxes, (b) => b.category)
      .join((enter) => {
        const e = enter.append("g").attr("class", "d3s-box");
        e.append("line").attr("class", "whisker");
        e.append("rect");
        e.append("line").attr("class", "median");
        return e;
      })
      .call((s) =>
        bindTooltip(s, tooltip, (b) => [
          `${b.category} (n=${b.n})`,
          `max ${fmt(b.hi)} · Q3 ${fmt(b.q3)}`,
          `median ${fmt(b.median)}`,
          `Q1 ${fmt(b.q1)} · min ${fmt(b.lo)}`,
        ]),
      );
    g.attr("opacity", (b) => dimOpacity(ix, xField, b.category)).call((s) =>
      bindSelect(s, ix, xField, (b) => b.category),
    );
    tweenTranslate(g, ms, (b) => [x(b.category) ?? 0, 0]);
    const bw = x.bandwidth();
    g.select("line.whisker")
      .style("stroke", "var(--d3s-axis)")
      .attr("x1", bw / 2)
      .attr("x2", bw / 2)
      .call((s) =>
        animate(s, ms)
          .attr("y1", (b) => y(b.lo))
          .attr("y2", (b) => y(b.hi)),
      );
    g.select("rect")
      .style("fill", (b) => color(b.category))
      .attr("fill-opacity", 0.35)
      .style("stroke", (b) => color(b.category))
      .attr("rx", Math.min(3, theme.radius))
      .attr("width", bw)
      .call((s) =>
        animate(s, ms)
          .attr("y", (b) => y(b.q3))
          .attr("height", (b) => Math.max(1, y(b.q1) - y(b.q3))),
      );
    g.select("line.median")
      .style("stroke", (b) => color(b.category))
      .attr("stroke-width", 2)
      .attr("x2", bw)
      .call((s) =>
        animate(s, ms)
          .attr("y1", (b) => y(b.median))
          .attr("y2", (b) => y(b.median)),
      );
    g.selectAll<SVGCircleElement, number>("circle")
      .data((b) => b.outliers.map((v) => v))
      .join("circle")
      .attr("cx", bw / 2)
      .attr("cy", (v) => y(v))
      .attr("r", 2.5)
      .attr("fill", "none")
      .style("stroke", "var(--d3s-text-muted)");
  }

  return {
    update(rows) {
      boxes = d3
        .groups(rows, (r) => String(r[xField]))
        .map(([c, list]) => toBox(c, list.map((r) => Number(r[yField])).filter(Number.isFinite)))
        .sort((a, b) => byName(a.category, b.category));
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
