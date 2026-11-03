import * as d3 from "d3";
import type { ChartFactory } from "./types";
import {
  aggregate,
  animate,
  bindSelect,
  bindTooltip,
  byName,
  createFrame,
  createLegend,
  createTooltip,
  dimOpacity,
  interactionsOf,
  motionMs,
  need,
  stableColors,
  textOn,
  topN,
  tweenTranslate,
  formatter,
} from "./util";

interface Node {
  name: string;
  value?: number;
  children?: Node[];
}

/**
 * Rectangles sized by the aggregate of `y` (default `sum`) per `x`.
 * With `series`, rectangles nest inside one group per series value, colored by group.
 */
export const treemapChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const colors = stableColors();
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const how = spec.aggregate ?? "sum";
  const fmt = formatter(spec.format ?? ".3~s");
  let root: Node = { name: "root", children: [] };

  const frame = createFrame(el, spec.height ?? 240, () => draw(false), { top: 0, right: 0, bottom: 0, left: 0 });
  const g = frame.svg.append("g");
  const legend = createLegend(el, () => draw(false));
  const tooltip = createTooltip(el);
  const ix = interactionsOf(ctx);

  function draw(animated = true) {
    const { w, h } = frame.inner();
    // Legend: hide whole groups (with `series`) or single tiles.
    const allGroups = (root.children ?? []).map((c) => c.name).sort(byName);
    const shownRoot = { ...root, children: (root.children ?? []).filter((c) => legend.visible(c.name)) };
    const hierarchy = d3
      .hierarchy<Node>(shownRoot)
      .sum((d) => Math.max(0, d.value ?? 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const layout = d3
      .treemap<Node>()
      .size([w, h])
      .paddingInner(2)
      .paddingTop(spec.series ? 2 : 0)
      .round(true)(hierarchy);
    // An empty tree has the root as its only leaf: skip it.
    const leaves = layout.leaves().filter((n) => n.depth === (spec.series ? 2 : 1));
    const groupOf = (n: d3.HierarchyRectangularNode<Node>) => (spec.series ? n.parent!.data.name : n.data.name);
    const color = colors(theme, allGroups);
    const ms = animated ? motionMs(theme) : 0;
    const total = hierarchy.value ?? 0;

    const cell = g
      .selectAll<SVGGElement, d3.HierarchyRectangularNode<Node>>("g.d3s-leaf")
      .data(leaves, (n) => `${groupOf(n)}\u0000${n.data.name}`)
      .join((enter) => {
        const e = enter.append("g").attr("class", "d3s-leaf");
        e.append("rect");
        e.append("clipPath")
          .attr("id", () => `d3s-clip-${Math.random().toString(36).slice(2)}`)
          .append("rect");
        e.append("text").attr("class", "d3s-label");
        return e;
      });
    cell.call((s) => bindSelect(s, ix, xField, (n) => n.data.name));
    cell.call((s) =>
      bindTooltip(s, tooltip, (n) => [
        spec.series ? `${groupOf(n)} · ${n.data.name}` : n.data.name,
        `${fmt(n.value ?? 0)} (${d3.format(".1%")(total ? (n.value ?? 0) / total : 0)})`,
      ]),
    );
    tweenTranslate(cell, ms, (n) => [n.x0, n.y0]);
    cell
      .select("rect")
      .style("fill", (n) => color(groupOf(n)))
      .attr("opacity", (n) => dimOpacity(ix, xField, n.data.name))
      .attr("rx", Math.min(3, theme.radius))
      .call((s) =>
        animate(s, ms)
          .attr("width", (n) => n.x1 - n.x0)
          .attr("height", (n) => n.y1 - n.y0),
      );
    cell
      .select("clipPath rect")
      .attr("width", (n) => n.x1 - n.x0)
      .attr("height", (n) => n.y1 - n.y0);
    cell
      .select<SVGTextElement>("text")
      .attr("clip-path", function () {
        return `url(#${(this.parentNode as Element).querySelector("clipPath")!.id})`;
      })
      .attr("x", 6)
      .attr("y", 16)
      // Dark text on light tiles, light text on dark tiles.
      .style("fill", (n) => textOn(theme, color(groupOf(n))))
      .text((n) => (n.x1 - n.x0 > 40 && n.y1 - n.y0 > 20 ? `${n.data.name} ${fmt(n.value ?? 0)}` : ""));

    legend.update(allGroups, color, Boolean(spec.series));
  }

  return {
    update(rows) {
      const agg = (v: typeof rows) =>
        aggregate(
          v.map((r) => Number(r[yField])),
          how,
        );
      if (spec.series) {
        const s = spec.series;
        root = {
          name: "root",
          children: d3
            .rollups(
              rows,
              agg,
              (r) => String(r[s]),
              (r) => String(r[xField]),
            )
            .map(([name, inner]) => ({
              name,
              children: inner.map(([leaf, value]) => ({ name: leaf, value })),
            })),
        };
      } else {
        const entries = topN(
          d3.rollups(rows, agg, (r) => String(r[xField])),
          spec.limit,
        );
        root = { name: "root", children: entries.map(([name, value]) => ({ name, value })) };
      }
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
