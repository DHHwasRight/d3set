import type { Cases } from "./types";

const small = [
  { t: "2026-01-01T00:00:00Z", s: "b", v: 4 },
  { t: "2026-01-01T00:01:00Z", s: "a", v: 2 },
  { t: "2026-01-01T00:02:00Z", s: "b", v: -1 },
  { t: "2026-01-01T00:02:00Z", s: "a", v: 6 },
  { t: "2026-01-01T00:04:00Z", s: "a", v: 3 },
];

export const cases: Cases = {
  "line series aggregate": {
    spec: { type: "line", x: "at", y: "amount", series: "region", aggregate: "sum", interval: "1m" },
  },
  "line default": { spec: { type: "line", x: "at", y: "latency" } },
  "line numeric x": {
    spec: { type: "line", x: "n", y: "v", series: "s" },
    rows: [
      { n: 3, s: "a", v: 5 },
      { n: 1, s: "a", v: 2 },
      { n: 2, s: "b", v: -4 },
      { n: 7.5, s: "b", v: 9 },
      { n: 5, s: "a", v: 1.5 },
    ],
  },
  "line thresholds": {
    spec: {
      type: "line",
      x: "at",
      y: "latency",
      aggregate: "max",
      interval: "5m",
      format: ",.0f",
      thresholds: [
        { op: ">", value: 500, level: "warning" },
        { op: ">", value: 700, label: "SLO", color: "#ff00aa" },
        { op: ">", value: 99999 },
      ],
    },
  },
  "line single point": { spec: { type: "line", x: "t", y: "v" }, rows: [{ t: "2026-01-01T00:00:00Z", v: 3 }] },
  "area stacked": { spec: { type: "area", x: "at", y: "amount", series: "host", aggregate: "sum", interval: "2m" } },
  "area overlap": {
    spec: { type: "area", x: "at", y: "amount", series: "product", aggregate: "avg", interval: "5m", stacked: false },
  },
  "timeseries line": { spec: { type: "timeseries", x: "at", y: "amount" } },
  "timeseries area": { spec: { type: "timeseries", x: "at", y: "amount", series: "region", display: "area" } },
  "timeseries bars": { spec: { type: "timeseries", x: "at", y: "errors", display: "bars" } },
  "timeseries interval 1m": {
    spec: { type: "timeseries", x: "at", y: "latency", series: "host", interval: "1m", aggregate: "avg" },
  },
  "timeseries bars series": {
    spec: {
      type: "timeseries",
      x: "at",
      y: "seats",
      series: "product",
      display: "bars",
      interval: "5m",
      thresholds: [{ op: ">", value: 100, level: "ok" }],
    },
  },
  "timeseries empty": { spec: { type: "timeseries", x: "at", y: "amount" }, rows: [] },
  "line empty": { spec: { type: "line", x: "at", y: "amount" }, rows: [] },
  "timeseries bars small": {
    spec: { type: "timeseries", x: "t", y: "v", series: "s", display: "bars", interval: "1m" },
    rows: small,
  },
  "line small": { spec: { type: "line", x: "t", y: "v", series: "s" }, rows: small },
  "area small": { spec: { type: "area", x: "t", y: "v", series: "s", height: 180 }, rows: small, width: 520 },
};
