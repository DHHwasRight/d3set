// `d3set/core` has no chart types. `d3set/lazy` loads each one as a chunk of its own, so a page
// downloads the code of the chart types it draws, and only those.
import type { ChartPayload, DashboardPayload } from "d3set/core";
import { loadCharts } from "d3set/lazy";

/** Load every chart type the charts and dashboards of a page use. */
export function loadChartTypes(charts: ChartPayload[], dashboards: DashboardPayload[]): Promise<void> {
  return loadCharts([...charts.map((c) => c.spec.type), ...dashboards.flatMap((d) => d.charts.map((c) => c.type))]);
}
