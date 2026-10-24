import * as d3 from "d3";
import type { Row } from "../data/types";
import type { ChartSpec } from "./types";
import { aggregate, asDate } from "./util";

export type XValue = number | Date;

export interface SeriesData {
  keys: string[];
  /** Sorted distinct x values. */
  xs: XValue[];
  isTime: boolean;
  /** value(seriesKey, x) -> y, or undefined when the series has no point at x. */
  table: Map<number, Map<string, number>>;
}

/**
 * Turn rows into series over a shared x domain. Used by `line` and `area`.
 * With an aggregate, rows with the same series and x are combined.
 * Without one, the last row wins.
 */
export function toSeriesData(rows: Row[], spec: ChartSpec, xField: string, yField: string): SeriesData {
  const how = spec.aggregate ?? "last";
  const keyOf = (r: Row) => (spec.series ? String(r[spec.series]) : yField);
  const keys: string[] = [];
  const seen = new Set<string>();
  const cells = new Map<number, Map<string, number[]>>();
  let isTime = false;
  const xByNum = new Map<number, XValue>();

  for (const r of rows) {
    const raw = r[xField];
    const date = asDate(raw);
    if (date) isTime = true;
    const x: XValue = date ?? Number(raw);
    const n = +x;
    if (Number.isNaN(n)) continue;
    xByNum.set(n, x);
    const k = keyOf(r);
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
    let row = cells.get(n);
    if (!row) cells.set(n, (row = new Map()));
    let list = row.get(k);
    if (!list) row.set(k, (list = []));
    list.push(Number(r[yField]));
  }

  const table = new Map<number, Map<string, number>>();
  const sortedX = [...cells.keys()].sort((a, b) => a - b);
  for (const n of sortedX) {
    const out = new Map<string, number>();
    for (const [k, list] of cells.get(n)!) out.set(k, aggregate(list, how));
    table.set(n, out);
  }
  return { keys, xs: sortedX.map((n) => xByNum.get(n)!), isTime, table };
}

export function xScale(data: SeriesData, w: number) {
  const ext = d3.extent(data.xs, (x) => +x) as [number, number] | [undefined, undefined];
  const domain: [number, number] = ext[0] === undefined ? [0, 1] : [ext[0], ext[1]!];
  return data.isTime
    ? d3.scaleTime().domain(domain.map((v) => new Date(v)) as [Date, Date]).range([0, w])
    : d3.scaleLinear().domain(domain).range([0, w]);
}

export function formatX(x: XValue): string {
  return x instanceof Date ? d3.timeFormat("%Y-%m-%d %H:%M")(x) : String(x);
}

/**
 * Hover overlay for x-based charts: finds the nearest x and calls `onHover`.
 * Returns the overlay so the caller can size it.
 */
export function xHover(
  plot: d3.Selection<SVGGElement, unknown, null, undefined>,
  getXs: () => XValue[],
  invert: (px: number) => number,
  onHover: (x: XValue | undefined, event: PointerEvent) => void,
) {
  const rule = plot.append("line").attr("class", "d3s-rule").attr("stroke", "var(--d3s-axis)").attr("stroke-dasharray", "3 3").attr("hidden", true);
  const overlay = plot
    .append("rect")
    .attr("fill", "transparent")
    .on("pointermove", (event: PointerEvent) => {
      const xs = getXs();
      if (!xs.length) return;
      const target = invert(d3.pointer(event)[0]);
      const i = d3.bisector((x: XValue) => +x).center(xs, target);
      onHover(xs[i], event);
    })
    .on("pointerleave", (event: PointerEvent) => {
      rule.attr("hidden", true);
      onHover(undefined, event);
    });
  return {
    resize(w: number, h: number) {
      overlay.attr("width", w).attr("height", h);
      rule.attr("y1", 0).attr("y2", h);
    },
    moveRule(px: number | undefined) {
      if (px === undefined) rule.attr("hidden", true);
      else rule.attr("hidden", null).attr("x1", px).attr("x2", px).raise();
    },
  };
}
