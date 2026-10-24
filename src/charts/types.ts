import type { Row } from "../data/types";
import type { Theme } from "../theme/theme";

export type Aggregate = "sum" | "count" | "avg" | "min" | "max" | "last";

export interface ColumnSpec {
  field: string;
  label?: string;
  /** d3-format string for numbers. */
  format?: string;
  align?: "left" | "center" | "right";
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

  /** Extra options for custom chart types. */
  options?: Record<string, unknown>;
}

export interface ChartContext {
  theme: Theme;
}

export interface Chart {
  update(rows: Row[]): void;
  setTheme(theme: Theme): void;
  destroy(): void;
}

export type ChartFactory = (el: HTMLElement, spec: ChartSpec, ctx: ChartContext) => Chart;
