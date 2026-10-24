import type { Row } from "../data/types";
import type { Theme } from "../theme/theme";

export type Aggregate = "sum" | "count" | "avg" | "min" | "max" | "last";

export interface ChartSpec {
  /** Chart type name in the registry: `line`, `bar`, `kpi`, or a custom type. */
  type: string;
  title?: string;
  /** Field for the x axis (or the category for `bar`). */
  x?: string;
  /** Field for the value. */
  y: string;
  /** Optional field that splits rows into series (one color each). */
  series?: string;
  /** How to combine rows with the same x (and series). Default: `sum` for bar, none for line. */
  aggregate?: Aggregate;
  /** d3-format string for values, for example `,.0f` or `$.2s`. */
  format?: string;
  /** Chart height in px. Default: 240. */
  height?: number;
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
