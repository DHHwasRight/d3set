// The library without its chart types: hydration, dashboards, filters, data sources, themes, and
// the chart registry. Nothing here registers a chart, so a bundler ships only the chart types an
// app imports and registers (or loads with `./lazy`). `index.ts` is this plus every built-in type.
export { createDashboard, cardChartWidth, type Dashboard, type DashboardOptions } from "./dashboard";
export { createChart, type ChartOptions, type MountedChart } from "./chart";
export {
  hydrate,
  payloadTypes,
  streamSource,
  type ChartPayload,
  type DashboardPayload,
  type HydrateOptions,
  type Hydrated,
  type StreamOption,
} from "./hydrate";

export {
  applyTheme,
  createTheme,
  darkTheme,
  lightDark,
  lightTheme,
  namedVar,
  themeToCssVars,
  type Theme,
} from "./theme/theme";

export { sseSource, buildUrl, type SseSourceOptions } from "./data/sse";
export { pollSource, type PollSourceOptions, type Timeline } from "./data/poll";
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
export { getChart, registerChart } from "./charts/registry";
export { isDimmed, noInteractions, type Interactions, type RangeValue } from "./charts/interactions";
export { bindSelect, createLegend, dimOpacity, rangeBrush } from "./charts/util";
