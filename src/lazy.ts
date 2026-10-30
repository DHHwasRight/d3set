// Chart types loaded on demand. Each built-in type is a dynamic import, so a bundler splits it
// into a chunk of its own, and a page downloads only the types its charts use.
//
//   import { hydrate } from "d3set/core";
//   import { loadChartsFor } from "d3set/lazy";
//   await loadChartsFor(document);
//   hydrate(document);

import { registerChart, hasChart } from "./charts/registry";
import type { ChartFactory } from "./charts/types";
import { payloadTypes } from "./hydrate";

/** A loader per built-in chart type. */
export const chartLoaders: Record<string, () => Promise<ChartFactory>> = {
  timeseries: () => import("./charts/timeseries").then((m) => m.timeseriesChart),
  line: () => import("./charts/line").then((m) => m.lineChart),
  area: () => import("./charts/area").then((m) => m.areaChart),
  bar: () => import("./charts/bar").then((m) => m.barChart),
  pie: () => import("./charts/pie").then((m) => m.pieChart),
  donut: () => import("./charts/pie").then((m) => m.donutChart),
  scatter: () => import("./charts/scatter").then((m) => m.scatterChart),
  heatmap: () => import("./charts/heatmap").then((m) => m.heatmapChart),
  histogram: () => import("./charts/histogram").then((m) => m.histogramChart),
  boxplot: () => import("./charts/boxplot").then((m) => m.boxplotChart),
  treemap: () => import("./charts/treemap").then((m) => m.treemapChart),
  funnel: () => import("./charts/funnel").then((m) => m.funnelChart),
  gauge: () => import("./charts/gauge").then((m) => m.gaugeChart),
  kpi: () => import("./charts/kpi").then((m) => m.kpiChart),
  table: () => import("./charts/table").then((m) => m.tableChart),
  toplist: () => import("./charts/toplist").then((m) => m.toplistChart),
  change: () => import("./charts/change").then((m) => m.changeChart),
  timeheatmap: () => import("./charts/timeheatmap").then((m) => m.timeheatmapChart),
  hostmap: () => import("./charts/hostmap").then((m) => m.hostmapChart),
  status: () => import("./charts/status").then((m) => m.statusChart),
  stream: () => import("./charts/stream").then((m) => m.streamChart),
  sunburst: () => import("./charts/sunburst").then((m) => m.sunburstChart),
  slo: () => import("./charts/slo").then((m) => m.sloChart),
  note: () => import("./charts/note").then((m) => m.noteChart),
};

/**
 * Register the given chart types, loading those not registered yet. A type with no loader is
 * left to the app, which registers it itself; `getChart` names it if it is still missing.
 */
export async function loadCharts(types: Iterable<string>): Promise<void> {
  await Promise.all(
    [...new Set(types)]
      .filter((type) => !hasChart(type) && chartLoaders[type])
      .map(async (type) => registerChart(type, await chartLoaders[type]!())),
  );
}

/** Load the chart types that the server-rendered payloads under `root` use. */
export function loadChartsFor(root: ParentNode = document): Promise<void> {
  return loadCharts(payloadTypes(root));
}
