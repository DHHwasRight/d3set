import type { Row } from "../data/types";
import type { ChartFactory, ChartSpec } from "./types";

const registry = new Map<string, ChartFactory>();

/** Add a chart type. Custom types use the same theme, data, and filters as the built-in types. */
export function registerChart(type: string, factory: ChartFactory): void {
  registry.set(type, factory);
}

/** Whether a chart type is registered. */
export function hasChart(type: string): boolean {
  return registry.has(type);
}

export function getChart(type: string): ChartFactory {
  const f = registry.get(type);
  if (!f) throw new Error(`d3set: unknown chart type '${type}'. Registered types: ${[...registry.keys()].join(", ")}.`);
  return (el, spec, ctx) => {
    const chart = f(el, spec, ctx);
    const keep = rowFilter(spec);
    if (!keep) return chart;
    const update = chart.update.bind(chart);
    chart.update = (rows) => update(rows.filter(keep));
    return chart;
  };
}

/**
 * `options.where: "field=value"`: the chart gets only the rows where `field` is `value` (compared
 * as text). Lets charts of one dashboard read different row sets from the same source.
 */
export function rowFilter(spec: ChartSpec): ((r: Row) => boolean) | undefined {
  const where = spec.options?.where;
  if (where === undefined) return undefined;
  const m = typeof where === "string" ? /^([^=]+)=(.*)$/.exec(where) : null;
  if (!m) throw new Error(`d3set: invalid where '${String(where)}'. Use 'field=value'.`);
  const [, field, value] = m as unknown as [string, string, string];
  return (r) => r[field] != null && String(r[field]) === value;
}
