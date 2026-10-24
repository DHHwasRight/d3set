import * as d3 from "d3";
import type { Row } from "../data/types";
import type { ChartFactory } from "./types";
import { aggregate, asDate, createFrame, createLegend, margin, motionMs, seriesColor } from "./util";

interface Point {
  x: number | Date;
  y: number;
}

export const lineChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  let rows: Row[] = [];
  const xField = spec.x ?? "x";
  const frame = createFrame(el, spec.height ?? 240, () => draw(false));
  const legend = createLegend(el);
  const g = frame.svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const gridG = g.append("g").attr("class", "d3s-grid-y");
  const xAxisG = g.append("g").attr("class", "d3s-axis-x");
  const yAxisG = g.append("g").attr("class", "d3s-axis-y");
  const linesG = g.append("g");
  const fmt = d3.format(spec.format ?? "~s");

  function toSeries(): Map<string, Point[]> {
    const bySeries = d3.group(rows, (r) => (spec.series ? String(r[spec.series]) : spec.y));
    const out = new Map<string, Point[]>();
    for (const [key, list] of bySeries) {
      let points: Point[];
      if (spec.aggregate) {
        points = d3
          .rollups(
            list,
            (v) => aggregate(v.map((r) => Number(r[spec.y])), spec.aggregate!),
            (r) => String(r[xField]),
          )
          .map(([x, y]) => ({ x: asDate(x) ?? Number(x), y }));
      } else {
        points = list.map((r) => ({ x: asDate(r[xField]) ?? Number(r[xField]), y: Number(r[spec.y]) }));
      }
      points.sort((a, b) => +a.x - +b.x);
      out.set(key, points);
    }
    return out;
  }

  function draw(animate = true) {
    const { w, h } = frame.inner();
    const series = toSeries();
    const all = [...series.values()].flat();
    const isTime = all[0]?.x instanceof Date;
    const xExtent = d3.extent(all, (p) => +p.x) as [number, number];
    const x = isTime
      ? d3.scaleTime().domain(xExtent.map((v) => new Date(v)) as [Date, Date]).range([0, w])
      : d3.scaleLinear().domain(xExtent[0] === undefined ? [0, 1] : xExtent).range([0, w]);
    const y = d3
      .scaleLinear()
      .domain([Math.min(0, d3.min(all, (p) => p.y) ?? 0), d3.max(all, (p) => p.y) ?? 1])
      .nice()
      .range([h, 0]);
    const color = seriesColor(theme, [...series.keys()]);
    const ms = animate ? motionMs(theme) : 0;

    xAxisG.attr("transform", `translate(0,${h})`).call(d3.axisBottom(x as d3.AxisScale<d3.NumberValue>).ticks(Math.max(2, w / 90)).tickSizeOuter(0));
    yAxisG.call(d3.axisLeft(y).ticks(5).tickFormat((v) => fmt(v as number)));
    gridG.call(d3.axisLeft(y).ticks(5).tickSize(-w).tickFormat(() => "")).call((s) => s.select(".domain").remove());

    const line = d3
      .line<Point>()
      .x((p) => x(p.x as never))
      .y((p) => y(p.y))
      .curve(d3.curveMonotoneX);

    linesG
      .selectAll<SVGPathElement, [string, Point[]]>("path")
      .data([...series], (d) => d[0])
      .join("path")
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("stroke", ([k]) => color(k))
      .transition().duration(ms)
      .attr("d", ([, pts]) => line(pts));

    legend.update([...series.keys()], color);
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
