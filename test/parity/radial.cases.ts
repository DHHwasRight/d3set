import type { Cases } from "./types";

export const cases: Cases = {
  "pie default": { spec: { type: "pie", x: "product", y: "amount" } },
  "pie limit": { spec: { type: "pie", x: "host", y: "latency", limit: 3 } },
  "pie aggregate count": { spec: { type: "pie", x: "region", y: "amount", aggregate: "count" } },
  "pie hand-made": {
    spec: { type: "pie", x: "c", y: "v", height: 180 },
    rows: [
      { c: "b", v: 3 },
      { c: "a", v: 1 },
      { c: "c", v: -2 },
      { c: "a", v: 4 },
    ],
    width: 300,
  },
  "pie single slice": { spec: { type: "pie", x: "c", y: "v" }, rows: [{ c: "only", v: 5 }] },
  "donut default": { spec: { type: "donut", x: "region", y: "amount" } },
  "donut innerRadius 0.4": { spec: { type: "donut", x: "product", y: "seats", innerRadius: 0.4 } },
  "sunburst product by region": { spec: { type: "sunburst", x: "product", y: "amount", series: "region" } },
  "sunburst avg": {
    spec: { type: "sunburst", x: "host", y: "latency", series: "product", aggregate: "avg", height: 300 },
  },
  "sunburst hand-made": {
    spec: { type: "sunburst", x: "leaf", y: "v", series: "g" },
    rows: [
      { g: "B", leaf: "x", v: 2 },
      { g: "A", leaf: "y", v: 5 },
      { g: "A", leaf: "z", v: 1 },
      { g: "B", leaf: "w", v: 0 },
    ],
  },
  "gauge default": { spec: { type: "gauge", y: "errors" } },
  "gauge min max thresholds": {
    spec: {
      type: "gauge",
      y: "seats",
      aggregate: "max",
      min: 10,
      max: 60,
      thresholds: [
        { op: ">", value: 45, level: "critical" },
        { op: ">", value: 30, level: "warning" },
        { op: "<", value: 5, color: "#123456" },
      ],
    },
  },
  "gauge avg": { spec: { type: "gauge", y: "seats", aggregate: "avg", format: ".1f" } },
  "gauge empty": { spec: { type: "gauge", y: "amount" }, rows: [] },
  "gauge hand-made clamped": {
    spec: { type: "gauge", y: "v", max: 10, height: 120, thresholds: [{ op: "<", value: 20, level: "ok" }] },
    rows: [{ v: 7 }, { v: 8 }],
    width: 260,
  },
};

/**
 * Empty rows for the charts with a forced legend. The marks match (an empty `<g>`), but the browser
 * keeps an empty, visible `.d3s-legend` div, and `views/frame.rsx` (`ChartElement`) writes no legend
 * div when there are no legend items, so `legendHidden` is `null` on the server and `false` in the
 * browser. Merge these into `cases` once `ChartElement` writes the legend div for `force_legend`.
 */
export const emptyCases: Cases = {
  "pie empty": { spec: { type: "pie", x: "product", y: "amount" }, rows: [] },
  "donut empty": { spec: { type: "donut", x: "region", y: "amount" }, rows: [] },
  "sunburst empty": { spec: { type: "sunburst", x: "product", y: "amount", series: "region" }, rows: [] },
};

Object.assign(cases, emptyCases);
