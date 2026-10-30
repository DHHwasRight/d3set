import "./style.css";

// Everything, with every built-in chart type registered. To ship only some chart types, import
// `./core` and register them, or load them on demand with `./lazy`.
export * from "./core";
import { registerBuiltInCharts } from "./charts/index";

registerBuiltInCharts();
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
  builtInCharts,
  registerBuiltInCharts,
  donutChart,
  funnelChart,
  gaugeChart,
  getChart,
  heatmapChart,
  histogramChart,
  kpiChart,
  lineChart,
  pieChart,
  registerChart,
  scatterChart,
  tableChart,
  treemapChart,
} from "./charts/index";
