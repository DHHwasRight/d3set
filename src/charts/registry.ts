import type { ChartFactory } from "./types";

const registry = new Map<string, ChartFactory>();

/** Add a chart type. Custom types use the same theme, data, and filters as the built-in types. */
export function registerChart(type: string, factory: ChartFactory): void {
  registry.set(type, factory);
}

export function getChart(type: string): ChartFactory {
  const f = registry.get(type);
  if (!f) throw new Error(`d3set: unknown chart type '${type}'. Registered types: ${[...registry.keys()].join(", ")}.`);
  return f;
}
