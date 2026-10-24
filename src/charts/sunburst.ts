import * as d3 from "d3";
import type { ChartFactory } from "./types";
import {
  aggregate,
  bindTooltip,
  createFrame,
  createLegend,
  createTooltip,
  motionMs,
  need,
  seriesColor,
  animate,
} from "./util";

interface Node {
  name: string;
  value?: number;
  children?: Node[];
}

type Arc = d3.HierarchyRectangularNode<Node>;

/**
 * Two-level share of a total: inner ring per `series` value, outer ring per `x` value,
 * sized by the aggregate of `y` (default `sum`).
 */
export const sunburstChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const groupField = need(spec, "series");
  const fmt = d3.format(spec.format ?? ".3~s");
  const pct = d3.format(".1%");
  let root: Node = { name: "root", children: [] };

  const frame = createFrame(el, spec.height ?? 240, () => draw(false), { top: 4, right: 4, bottom: 4, left: 4 });
  const g = frame.svg.append("g");
  const legend = createLegend(el);
  const tooltip = createTooltip(el);

  function draw(animated = true) {
    const { w, h } = frame.inner();
    const r = Math.max(0, Math.min(w, h) / 2);
    g.attr("transform", `translate(${frame.margin.left + w / 2},${frame.margin.top + h / 2})`);
    const hierarchy = d3
      .hierarchy(root)
      .sum((d) => Math.max(0, d.value ?? 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const nodes = d3
      .partition<Node>()
      .size([2 * Math.PI, 3])(hierarchy)
      .descendants()
      .filter((n) => n.depth > 0);
    const total = hierarchy.value ?? 0;
    const groups = (root.children ?? []).map((c) => c.name);
    const color = seriesColor(theme, groups);
    const groupOf = (n: Arc) => (n.depth === 1 ? n.data.name : n.parent!.data.name);
    // Ring 1 from 30% to 62% of the radius, ring 2 from 64% to 100%.
    const radii = [0, [0.3, 0.62], [0.64, 1]] as const;
    const arc = d3
      .arc<Arc>()
      .startAngle((n) => n.x0)
      .endAngle((n) => n.x1)
      .padAngle(0.006)
      .innerRadius((n) => r * (radii[n.depth] as readonly number[])[0]!)
      .outerRadius((n) => r * (radii[n.depth] as readonly number[])[1]!);

    g.selectAll<SVGPathElement, Arc>("path")
      .data(nodes, (n) => `${groupOf(n)}\u0000${n.depth === 2 ? n.data.name : ""}`)
      .join("path")
      .attr("fill", (n) => color(groupOf(n)))
      .attr("fill-opacity", (n) => (n.depth === 1 ? 1 : 0.6))
      .call((s) =>
        bindTooltip(s, tooltip, (n) => [
          n.depth === 1 ? n.data.name : `${groupOf(n)} › ${n.data.name}`,
          `${fmt(n.value ?? 0)} (${pct(total ? (n.value ?? 0) / total : 0)})`,
        ]),
      )
      .call((s) => animate(s, animated ? motionMs(theme) : 0).attr("d", arc));

    legend.update(groups, color, true);
  }

  return {
    update(rows) {
      const agg = (v: typeof rows) =>
        aggregate(
          v.map((r) => Number(r[yField])),
          spec.aggregate ?? "sum",
        );
      root = {
        name: "root",
        children: d3
          .rollups(
            rows,
            agg,
            (r) => String(r[groupField]),
            (r) => String(r[xField]),
          )
          .map(([name, inner]) => ({ name, children: inner.map(([leaf, value]) => ({ name: leaf, value })) })),
      };
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
