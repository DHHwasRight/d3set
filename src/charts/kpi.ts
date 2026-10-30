import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { toSeriesData } from "./xy";
import { aggregate, need, valueColor } from "./util";

/**
 * A big number: the aggregate of `y` over all rows (default `sum`).
 * `thresholds` color the number.
 * With `x`, it also shows a trend line per x value and the change of the last x value against the one before.
 * `options.value: "last"` (with `x`): the big number is the value of the last x point instead.
 * `options.period: N` (with `x`, a positive integer): the period is the last N trend points. The big
 * number combines their values (with the aggregate; `count` adds the counts) and the delta compares it
 * with the N points before them (or as many as exist). With `value: "last"`, the big number is the
 * last point and the delta compares it with the point N places before. The delta then says "vs previous period".
 */
export const kpiChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  let current = 0;
  const yField = need(spec, "y");
  const how = spec.aggregate ?? "sum";
  const lastPoint = Boolean(spec.x) && spec.options?.value === "last";
  const p = spec.options?.period;
  const period = spec.x && typeof p === "number" && Number.isInteger(p) && p > 0 ? p : undefined;
  // How the values of several points combine into one: a count of counts is their sum.
  const combine = how === "count" ? "sum" : how;
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
      // One point per x value, aggregated with the same rule as the big number.
      const data = spec.x && toSeriesData(rows, { ...spec, series: undefined, aggregate: how }, spec.x, yField);
      const points = data ? data.xs.map((x) => [+x, data.table.get(+x)!.get(yField) ?? 0] as [number, number]) : [];
      const values = points.map((pt) => pt[1]);
      const n = values.length;
      // The value the big number is compared with, for the delta.
      let previous: number | undefined;
      if (period && lastPoint) {
        current = values.at(-1) ?? 0;
        previous = n - 1 - period >= 0 ? values[n - 1 - period] : undefined;
      } else if (period) {
        current = aggregate(values.slice(-period), combine);
        const before = values.slice(Math.max(0, n - 2 * period), Math.max(0, n - period));
        previous = before.length ? aggregate(before, combine) : undefined;
      } else {
        current = lastPoint
          ? (values.at(-1) ?? 0)
          : aggregate(
              rows.map((r) => Number(r[yField])),
              how,
            );
      }
      value.textContent = fmt(current);
      value.style.color = valueColor(theme, current, spec.thresholds, "");
      if (!spec.x || !svg) return;

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

      // Without `period`: the last point against the one before it.
      const last = period ? current : values.at(-1);
      const prev = period ? previous : values.at(-2);
      if (last === undefined || prev === undefined || prev === 0) {
        delta.textContent = "";
        delete delta.dataset.trend;
      } else {
        const change = (last - prev) / Math.abs(prev);
        const vs = period ? "vs previous period" : "vs previous";
        delta.textContent = `${change >= 0 ? "▲" : "▼"} ${d3.format(".1%")(Math.abs(change))} ${vs}`;
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
