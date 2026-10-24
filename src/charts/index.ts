import { changeChart } from "./change";
import { hostmapChart } from "./hostmap";
import { noteChart } from "./note";
import { sloChart } from "./slo";
import { statusChart } from "./status";
import { streamChart } from "./stream";
import { sunburstChart } from "./sunburst";
import { timeheatmapChart } from "./timeheatmap";
import { timeseriesChart } from "./timeseries";
import { toplistChart } from "./toplist";
import { areaChart } from "./area";
import { barChart } from "./bar";
import { boxplotChart } from "./boxplot";
import { funnelChart } from "./funnel";
import { gaugeChart } from "./gauge";
import { heatmapChart } from "./heatmap";
import { histogramChart } from "./histogram";
import { kpiChart } from "./kpi";
import { lineChart } from "./line";
import { donutChart, pieChart } from "./pie";
import { registerChart } from "./registry";
import { scatterChart } from "./scatter";
import { tableChart } from "./table";
import { treemapChart } from "./treemap";

export const builtInCharts = {
  timeseries: timeseriesChart,
  line: lineChart,
  area: areaChart,
  bar: barChart,
  pie: pieChart,
  donut: donutChart,
  scatter: scatterChart,
  heatmap: heatmapChart,
  histogram: histogramChart,
  boxplot: boxplotChart,
  treemap: treemapChart,
  funnel: funnelChart,
  gauge: gaugeChart,
  kpi: kpiChart,
  table: tableChart,
  toplist: toplistChart,
  change: changeChart,
  timeheatmap: timeheatmapChart,
  hostmap: hostmapChart,
  status: statusChart,
  stream: streamChart,
  sunburst: sunburstChart,
  slo: sloChart,
  note: noteChart,
};

for (const [type, factory] of Object.entries(builtInCharts)) registerChart(type, factory);

export {
  changeChart,
  hostmapChart,
  noteChart,
  sloChart,
  statusChart,
  streamChart,
  sunburstChart,
  timeheatmapChart,
  timeseriesChart,
  toplistChart,
  areaChart,
  barChart,
  boxplotChart,
  donutChart,
  funnelChart,
  gaugeChart,
  heatmapChart,
  histogramChart,
  kpiChart,
  lineChart,
  pieChart,
  scatterChart,
  tableChart,
  treemapChart,
};
export { getChart, registerChart } from "./registry";
export type * from "./types";
