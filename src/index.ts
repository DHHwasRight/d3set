import "./style.css";

export { createDashboard, type Dashboard, type DashboardOptions } from "./dashboard";

export { applyTheme, createTheme, darkTheme, lightTheme, themeToCssVars, type Theme } from "./theme/theme";

export { sseSource, buildUrl, type SseSourceOptions } from "./data/sse";
export { staticSource } from "./data/static";
export { mergeRows, type MergeOptions } from "./data/merge";
export type { DataSource, Envelope, MergeMode, Row, SourceState } from "./data/types";

export {
  applyFilters,
  dateRange,
  distinctValues,
  FilterStore,
  filtersToParams,
  multiSelect,
  range,
  search,
  select,
  type FilterDef,
  type FilterState,
  type FilterValue,
} from "./filters/filters";
export { renderFilterBar } from "./filters/bar";

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
export type {
  Aggregate,
  Chart,
  ChartContext,
  ChartFactory,
  ChartSpec,
  ColumnSpec,
  Level,
  Threshold,
} from "./charts/types";
export { isDimmed, noInteractions, type Interactions, type RangeValue } from "./charts/interactions";
export { bindSelect, createLegend, dimOpacity, rangeBrush } from "./charts/util";
