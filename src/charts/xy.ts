import * as d3 from "d3";
import type { Row } from "../data/types";
import type { ChartSpec } from "./types";
import type { Interactions } from "./interactions";
import { aggregate, asDate, bucket, byName, parseInterval } from "./util";

const niceSteps = ["1s", "5s", "10s", "30s", "1m", "5m", "10m", "30m", "1h", "3h", "6h", "12h", "1d", "1w"].map(
  parseInterval,
);

/** The smallest nice interval that gives at most `target` buckets over the time span of the rows. */
export function autoInterval(rows: Row[], xField: string, target = 60): number {
  const ext = d3.extent(rows, (r) => asDate(r[xField])?.getTime());
  const span = ext[0] === undefined ? 0 : ext[1]! - ext[0];
  return niceSteps.find((s) => span / s <= target) ?? niceSteps.at(-1)!;
}

export type XValue = number | Date;

export interface SeriesData {
  keys: string[];
  /** Sorted distinct x values. */
  xs: XValue[];
  isTime: boolean;
  /** value(seriesKey, x) -> y, or undefined when the series has no point at x. */
  table: Map<number, Map<string, number>>;
  /** Bucket length in ms when `interval` is set. */
  step?: number;
}

/**
 * Turn rows into series over a shared x domain. Used by `line` and `area`.
 * With an aggregate, rows with the same series and x are combined.
 * Without one, the last row wins. With `interval`, dates go into time buckets first.
 */
export function toSeriesData(rows: Row[], spec: ChartSpec, xField: string, yField: string): SeriesData {
  const how = spec.aggregate ?? "last";
  const keyOf = (r: Row) => (spec.series ? String(r[spec.series]) : yField);
  const keys: string[] = [];
  const seen = new Set<string>();
  const cells = new Map<number, Map<string, number[]>>();
  let isTime = false;
  const xByNum = new Map<number, XValue>();
  const step = !spec.interval
    ? undefined
    : spec.interval === "auto"
      ? autoInterval(rows, xField)
      : parseInterval(spec.interval);

  for (const r of rows) {
    const raw = r[xField];
    let date = asDate(raw);
    if (date) {
      isTime = true;
      if (step) date = bucket(date, step);
    }
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
  keys.sort(byName);
  return { keys, xs: sortedX.map((n) => xByNum.get(n)!), isTime, table, step: isTime ? step : undefined };
}

/** x scale over the data. With time buckets, the domain ends at the end of the last bucket. */
export function xScale(data: SeriesData, w: number) {
  const ext = d3.extent(data.xs, (x) => +x) as [number, number] | [undefined, undefined];
  const domain: [number, number] = ext[0] === undefined ? [0, 1] : [ext[0], ext[1]! + (data.step ?? 0)];
  return data.isTime
    ? d3
        .scaleUtc()
        .domain(domain.map((v) => new Date(v)) as [Date, Date])
        .range([0, w])
    : d3.scaleLinear().domain(domain).range([0, w]);
}

export function formatX(x: XValue): string {
  return x instanceof Date ? d3.utcFormat("%Y-%m-%d %H:%M")(x) : String(x);
}

export interface XInteractOptions {
  /** Sorted x values to snap the hover to. */
  xs: () => XValue[];
  /** The current x scale. */
  x: () => { (v: never): number; invert(px: number): number | Date };
  /** Shift applied to the pointer before snapping, in x units (bars start at the bucket start). */
  offset?: () => number;
  interactions: Interactions;
  /** Field that a brush filters. */
  field: string;
  onHover: (x: XValue | undefined, event: PointerEvent) => void;
}

/**
 * Pointer layer for x-based charts:
 * - hover snaps to the nearest x, draws a rule, and shares the time with other charts;
 * - drag (brush) sets a range filter on `field` for the whole dashboard (zoom);
 * - double-click clears that range.
 */
export function xInteract(plot: d3.Selection<SVGGElement, unknown, null, undefined>, o: XInteractOptions) {
  const rule = plot
    .append("line")
    .attr("class", "d3s-rule")
    .style("stroke", "var(--d3s-axis)")
    .attr("stroke-dasharray", "3 3")
    .attr("pointer-events", "none")
    .attr("hidden", true);

  const moveRule = (px: number | undefined) => {
    if (px === undefined || !Number.isFinite(px)) rule.attr("hidden", true);
    else rule.attr("hidden", null).attr("x1", px).attr("x2", px).raise();
  };

  // An explicit extent: the default one reads SVG sizes that are not always available.
  const brush = d3
    .brushX<unknown>()
    .extent([
      [0, 0],
      [1, 1],
    ])
    .on("end", (event: d3.D3BrushEvent<unknown>) => {
      if (!event.selection || !event.sourceEvent) return;
      const [a, b] = event.selection as [number, number];
      brushG.call(brush.move, null);
      if (b - a < 4) return;
      const x = o.x();
      const lo = x.invert(a);
      const hi = x.invert(b);
      o.interactions.setRange(
        o.field,
        lo instanceof Date ? { from: lo.toISOString(), to: (hi as Date).toISOString() } : { min: +lo, max: +hi },
      );
    });

  const brushG = plot
    .append("g")
    .attr("class", "d3s-brush")
    .call(brush)
    .on("pointermove.d3s", (event: PointerEvent) => {
      const xs = o.xs();
      if (!xs.length) return;
      const off = o.offset?.() ?? 0;
      const target = +o.x().invert(d3.pointer(event)[0]) - off;
      const hx = xs[d3.bisector((v: XValue) => +v).center(xs, target)]!;
      moveRule(o.x()((hx instanceof Date ? new Date(+hx + off) : +hx + off) as never));
      if (hx instanceof Date) o.interactions.hoverTime(+hx);
      o.onHover(hx, event);
    })
    .on("pointerleave.d3s", (event: PointerEvent) => {
      moveRule(undefined);
      o.interactions.hoverTime(undefined);
      o.onHover(undefined, event);
    })
    .on("dblclick.d3s", () => o.interactions.setRange(o.field, undefined));

  let size: [number, number] = [0, 0];

  // Rule for the time hovered in another chart.
  const off = o.interactions.onHoverTime((t) => {
    if (t === undefined) return moveRule(undefined);
    const xs = o.xs();
    if (!xs.length || !(xs[0] instanceof Date)) return;
    const px = o.x()(new Date(t) as never);
    moveRule(px >= 0 ? px : undefined);
  });

  return {
    resize(w: number, h: number) {
      // Re-apply the brush only on a size change: re-applying it during a drag (live data redraws) cancels the drag.
      if (w !== size[0] || h !== size[1]) {
        size = [w, h];
        brush.extent([
          [0, 0],
          [Math.max(1, w), Math.max(1, h)],
        ]);
        brushG.call(brush);
      }
      rule.attr("y1", 0).attr("y2", h);
    },
    moveRule,
    destroy: off,
  };
}
