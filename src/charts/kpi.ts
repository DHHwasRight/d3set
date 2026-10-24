import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { toSeriesData } from "./xy";
import { aggregate, need, valueColor } from "./util";

/**
 * A big number: the aggregate of `y` over all rows (default `sum`).
 * `thresholds` color the number.
 * With `x`, it also shows a trend line per x value and the change of the last x value against the one before.
 */
export const kpiChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  let current = 0;
  const yField = need(spec, "y");
  const how = spec.aggregate ?? "sum";
  el.classList.add("d3s-chart", "d3s-kpi");
  el.style.height = `${spec.height ?? (spec.x ? 120 : 72)}px`;
  el.style.display = "grid";
  el.style.gridTemplateRows = "auto auto 1fr";

  const value = document.createElement("div");
  value.className = "d3s-kpi-value";
  const delta = document.createElement("div");
  delta.className = "d3s-kpi-delta";
  el.append(value, delta);
  const fmt = d3.format(spec.format ?? ",.0f");

  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | undefined;
  if (spec.x)
    svg = d3
      .select(el)
      .append("svg")
      .attr("class", "d3s-kpi-trend")
      .attr("preserveAspectRatio", "none")
      .attr("viewBox", "0 0 100 30");

  return {
    update(rows) {
      current = aggregate(
        rows.map((r) => Number(r[yField])),
        how,
      );
      value.textContent = fmt(current);
      value.style.color = valueColor(theme, current, spec.thresholds, "");
      if (!spec.x || !svg) return;

      // One point per x value, aggregated with the same rule as the big number.
      const data = toSeriesData(rows, { ...spec, series: undefined, aggregate: how }, spec.x, yField);
      const points = data.xs.map((x) => [+x, data.table.get(+x)!.get(yField) ?? 0] as [number, number]);
      const x = d3
        .scaleLinear()
        .domain(d3.extent(points, (p) => p[0]) as [number, number])
        .range([0, 100]);
      const y = d3
        .scaleLinear()
        .domain(d3.extent(points, (p) => p[1]) as [number, number])
        .range([28, 2]);
      const line = d3
        .line<[number, number]>()
        .x((p) => x(p[0]))
        .y((p) => y(p[1]));
      const area = d3
        .area<[number, number]>()
        .x((p) => x(p[0]))
        .y0(30)
        .y1((p) => y(p[1]));
      svg
        .selectAll("path.area")
        .data([points])
        .join("path")
        .attr("class", "area")
        .attr("fill", "var(--d3s-accent)")
        .attr("fill-opacity", 0.12)
        .attr("d", area);
      svg
        .selectAll("path.line")
        .data([points])
        .join("path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", "var(--d3s-accent)")
        .attr("stroke-width", 1.5)
        .attr("vector-effect", "non-scaling-stroke")
        .attr("d", line);

      const last = points.at(-1)?.[1];
      const prev = points.at(-2)?.[1];
      if (last === undefined || prev === undefined || prev === 0) {
        delta.textContent = "";
        delete delta.dataset.trend;
      } else {
        const change = (last - prev) / Math.abs(prev);
        delta.textContent = `${change >= 0 ? "▲" : "▼"} ${d3.format(".1%")(Math.abs(change))} vs previous`;
        delta.dataset.trend = change >= 0 ? "up" : "down";
      }
    },
    setTheme(next) {
      theme = next;
      value.style.color = valueColor(theme, current, spec.thresholds, "");
    },
    destroy: () => el.replaceChildren(),
  };
};
