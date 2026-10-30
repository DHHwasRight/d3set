import type { Row } from "../data/types";
import type { Theme } from "../theme/theme";
import type { Interactions } from "./interactions";

export type Aggregate = "sum" | "count" | "avg" | "min" | "max" | "last";

export type Level = "ok" | "warning" | "critical";

/**
 * A conditional format rule, like Datadog conditional formats and markers.
 * Rules are tested in order; the first match wins.
 */
export interface Threshold {
  op: ">" | ">=" | "<" | "<=" | "=";
  value: number;
  level?: Level;
  /** Overrides the level color. */
  color?: string;
  /** Text on time series markers and status tiles. */
  label?: string;
}

export interface ColumnSpec {
  field: string;
  label?: string;
  /** d3-format string for numbers. */
  format?: string;
  align?: "left" | "center" | "right";
  /** Conditional text color for numbers in this column. */
  thresholds?: Threshold[];
}

/**
 * One chart. Fields not used by a chart type are ignored.
 * See the README for the fields each type reads.
 */
export interface ChartSpec {
  /** Chart type name in the registry, for example `line`, `bar`, `table`, or a custom type. */
  type: string;
  title?: string;
  /** Dimension field: x axis, category, or group-by field. */
  x?: string;
  /** Value field. */
  y?: string;
  /** Field that splits rows into series (one color each). For `heatmap`: the row dimension. */
  series?: string;
  /** How to combine rows with the same keys. Each type has its own default. */
  aggregate?: Aggregate;
  /** d3-format string for values, for example `,.0f` or `$.2s`. */
  format?: string;
  /** Chart height in px. */
  height?: number;
  /** Dashboard grid: number of columns the card takes (1 to 3). Default: 1. */
  span?: 1 | 2 | 3;

  /**
   * Time charts: bucket x values (dates) by this interval, for example `10s`, `1m`, `5m`, `1h`, `1d`.
   * `auto` picks an interval that gives about 60 buckets. `timeseries` uses `auto` by default.
   */
  interval?: string;
  /**
   * `slo`: a row is good when `y` passes the `good` rule. `target` is the objective in percent (for example 99.9).
   */
  objective?: { good: Pick<Threshold, "op" | "value">; target: number };
  /** `change`: compare the last `window` with the one before it, for example `5m` or `1d`. Default: `1h`. */
  window?: string;
  /** `change`: `true` when a decrease is good (latency, errors). Default: false. */
  decreaseIsGood?: boolean;
  /** `note`: the text to show. Blank lines split paragraphs. */
  text?: string;
  /** `timeseries`: how to draw the series. Default: `line`. */
  display?: "line" | "area" | "bars";
  /** Conditional colors (kpi, gauge, toplist, table, status, hostmap) and marker lines (timeseries). */
  thresholds?: Threshold[];

  /** `scatter`: field for the point area (bubble chart). */
  size?: string;
  /** `bar`, `area`: stack the series. */
  stacked?: boolean;
  /** `bar`: draw horizontal bars. */
  horizontal?: boolean;
  /** `table`: columns to show. Default: all fields of the first row. */
  columns?: ColumnSpec[];
  /** `table`: max rows. `bar`, `pie`, `treemap`, `funnel`: max categories, the rest go into "Other". */
  limit?: number;
  /** `histogram`: number of bins. Default: 20. */
  bins?: number;
  /** `gauge`: scale bounds. */
  min?: number;
  max?: number;
  /** `pie`: inner radius as a ratio of the outer radius (0 to 0.9). `donut` uses 0.6. */
  innerRadius?: number;

  /**
   * Extra options. Custom chart types read their own keys. Built-in keys:
   * - `where: "field=value"` (every type): keep only the rows where `field` is `value`.
   * - `ticks: "edges"` (line, area, bar, timeseries): the category or time axis labels only the
   *   first and last x value of the data (first label anchored at its start, last at its end); the
   *   value axis labels only its domain ends, plus 0 when the domain crosses it. Grid lines follow.
   * - `valueAxis: "right"` (line, area, vertical bar, timeseries): the value axis is on the right;
   *   margins become left 12, right 56.
   * - `curve: "linear"` (line, area, timeseries line and area): straight segments, not `curveMonotoneX`.
   * - `gradient: true` (area, timeseries area): each area is filled with a vertical gradient of its
   *   color (opacity 0.4 at the top, 0 at 60%) under a 2px line.
   * - `value: "last"` (kpi with `x`): the big number is the value of the last x point.
   * - `period: N` (kpi with `x`, a positive integer): the period is the last N trend points. The big
   *   number combines their values with the aggregate (`count` adds the counts), and the delta compares
   *   it with the N points before (as many as exist; none: no delta). With `value: "last"`: the last
   *   point against the point N places before. The delta reads "vs previous period".
   * - `categories: "a|b|c"` (bar): exactly these categories, in this order. A category with no rows
   *   keeps its band; rows of other categories are left out; `limit` is ignored.
   * - `axes: "none"` (bar, line, area, timeseries): no axes, no grid lines, and no margin; the marks
   *   fill the frame.
   * - `pivot: "field"` (table in group mode): one column per value of `field`.
   * - `swatch: true` (table in group mode): each line starts with a dot in the color of its `x` value.
   * - `sort: true` (funnel), `ascending: true` (toplist).
   */
  options?: Record<string, unknown>;
}

export interface ChartContext {
  theme: Theme;
  /** Dashboard links: cross-filters, brush ranges, shared hover. Absent when the chart is mounted alone. */
  interactions?: Interactions;
}

export interface Chart {
  update(rows: Row[]): void;
  setTheme(theme: Theme): void;
  destroy(): void;
}

export type ChartFactory = (el: HTMLElement, spec: ChartSpec, ctx: ChartContext) => Chart;
