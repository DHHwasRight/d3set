import type { Cases } from "./types";

export const cases: Cases = {
  // heatmap
  "heatmap defaults": { spec: { type: "heatmap", x: "host", y: "amount", series: "region" } },
  "heatmap many columns": {
    spec: { type: "heatmap", x: "seats", y: "latency", series: "product", aggregate: "avg", format: ",.1f" },
  },
  "heatmap count height": {
    spec: { type: "heatmap", x: "product", y: "errors", series: "host", aggregate: "count", height: 180 },
  },
  "heatmap empty": { spec: { type: "heatmap", x: "c", y: "v", series: "s" }, rows: [] },
  "heatmap small": {
    spec: { type: "heatmap", x: "day", y: "v", series: "s" },
    rows: [
      { day: "mon", s: "a", v: 1 },
      { day: "tue", s: "a", v: 4 },
      { day: "mon", s: "b", v: 2 },
      { day: "mon", s: "b", v: 3 },
    ],
  },

  // timeheatmap
  "timeheatmap defaults": { spec: { type: "timeheatmap", x: "at", y: "latency" } },
  "timeheatmap interval bins": {
    spec: { type: "timeheatmap", x: "at", y: "amount", interval: "5m", bins: 5, format: "$,.0f" },
  },
  "timeheatmap interval auto": {
    spec: { type: "timeheatmap", x: "at", y: "seats", interval: "auto", bins: 20, height: 300 },
  },
  "timeheatmap empty": { spec: { type: "timeheatmap", x: "at", y: "v" }, rows: [] },
  "timeheatmap small": {
    spec: { type: "timeheatmap", x: "t", y: "v", interval: "1h" },
    rows: [
      { t: "2026-10-24T10:05:00Z", v: 3 },
      { t: "2026-10-24T10:40:00Z", v: 7 },
      { t: "2026-10-24T11:10:00Z", v: 7 },
      { t: "2026-10-24T13:00:00Z", v: 1 },
      { t: "not a date", v: 5 },
      { t: "2026-10-24T13:30:00Z", v: "x" },
    ],
  },

  "timeheatmap one value": {
    spec: { type: "timeheatmap", x: "t", y: "v" },
    rows: [
      { t: "2026-10-24T10:00:00Z", v: 4 },
      { t: "2026-10-24T10:00:20Z", v: 4 },
    ],
  },

  // histogram
  "histogram defaults": { spec: { type: "histogram", y: "latency" } },
  "histogram bins format": { spec: { type: "histogram", y: "amount", bins: 7, format: "$,.0f" } },
  "histogram few bins": { spec: { type: "histogram", y: "seats", bins: 3, height: 200 } },
  "histogram empty": { spec: { type: "histogram", y: "v" }, rows: [] },
  "histogram one value": { spec: { type: "histogram", y: "v" }, rows: [{ v: 5 }, { v: 5 }, { v: "n/a" }] },
  "histogram small": {
    spec: { type: "histogram", y: "v", bins: 4 },
    rows: [{ v: 0 }, { v: 1 }, { v: 2.5 }, { v: 2.5 }, { v: 10 }, { v: -3 }],
  },

  // scatter
  "scatter defaults": { spec: { type: "scatter", x: "amount", y: "latency" } },
  "scatter time series": { spec: { type: "scatter", x: "at", y: "latency", series: "region" } },
  "scatter bubble": {
    spec: { type: "scatter", x: "amount", y: "latency", size: "seats", series: "product", format: ",.0f" },
  },
  "scatter limit": { spec: { type: "scatter", x: "at", y: "amount", limit: 25, series: "host" } },
  "scatter empty": { spec: { type: "scatter", x: "a", y: "b" }, rows: [] },
  "scatter small": {
    spec: { type: "scatter", x: "a", y: "b", size: "s" },
    rows: [
      { a: 1, b: 2, s: 4 },
      { a: -2, b: 0.5, s: 0 },
      { a: 3, b: "nope", s: 1 },
      { a: 4, b: -1, s: 16 },
    ],
  },

  "scatter one time row": { spec: { type: "scatter", x: "t", y: "v" }, rows: [{ t: "2026-10-24T10:00:00Z", v: 4 }] },
  "scatter limit zero": { spec: { type: "scatter", x: "seats", y: "amount", limit: 0 } },

  // boxplot
  "boxplot defaults": { spec: { type: "boxplot", x: "region", y: "latency" } },
  "boxplot hosts format": { spec: { type: "boxplot", x: "host", y: "amount", format: "$,.0f", height: 300 } },
  "boxplot empty": { spec: { type: "boxplot", x: "c", y: "v" }, rows: [] },
  "boxplot outliers": {
    spec: { type: "boxplot", x: "c", y: "v" },
    rows: [
      ...[10, 11, 12, 12, 13, 14, 15, 60].map((v) => ({ c: "b", v })),
      ...[-40, 20, 21, 22, 23].map((v) => ({ c: "a", v })),
      { c: "a", v: "x" },
      { c: "c", v: 5 },
      { c: "d", v: "none" },
    ],
  },
  "boxplot one value": { spec: { type: "boxplot", x: "c", y: "v" }, rows: [{ c: "a", v: 3 }] },
};
