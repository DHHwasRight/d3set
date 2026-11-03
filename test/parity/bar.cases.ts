import type { Cases } from "./types";

export const cases: Cases = {
  "bar grouped": { spec: { type: "bar", x: "product", y: "amount", series: "region" } },
  "bar stacked horizontal": {
    spec: { type: "bar", x: "host", y: "amount", series: "region", stacked: true, horizontal: true },
  },
  "bar horizontal label width": {
    spec: { type: "bar", x: "host", y: "amount", horizontal: true, options: { labelWidth: 200 } },
  },
  "bar short axis": {
    spec: { type: "bar", x: "host", y: "amount", format: ",.2f", options: { axisFormat: "short", valueAxis: "right" } },
  },
  "bar limit": { spec: { type: "bar", x: "host", y: "latency", limit: 3, format: "$,.0f" } },
  "bar where": {
    spec: { type: "bar", x: "product", y: "amount", series: "region", options: { where: "region=EU" } },
  },
  "table where": {
    spec: { type: "table", columns: [{ field: "host" }, { field: "level" }], options: { where: "level=error" } },
  },
  "bar where numeric": {
    spec: { type: "bar", x: "c", y: "v", options: { where: "k=1" } },
    rows: [
      { c: "a", v: 3, k: 1 },
      { c: "b", v: 7, k: 2 },
      { c: "c", v: 5 },
    ],
  },
  "table pivot": {
    spec: { type: "table", x: "region", y: "amount", aggregate: "sum", format: "$,.0f", options: { pivot: "product" } },
  },
  "table pivot series": {
    spec: {
      type: "table",
      x: "region",
      series: "level",
      y: "errors",
      aggregate: "count",
      options: { pivot: "product" },
    },
  },
  "table pivot gaps": {
    spec: { type: "table", x: "s", y: "v", aggregate: "sum", options: { pivot: "m" } },
    rows: [
      { s: "b", m: "2026-02", v: 3 },
      { s: "a", m: "2026-01", v: 7 },
      { s: "b", m: "2026-01", v: 5 },
      { s: "a", m: "2026-10", v: 1 },
    ],
  },
  "bar crowded labels": {
    spec: { type: "bar", x: "c", y: "v" },
    width: 260,
    rows: Array.from({ length: 12 }, (_, i) => ({ c: `2026-${String(i + 1).padStart(2, "0")}`, v: i + 1 })),
  },
  "bar edges look": {
    spec: { type: "bar", x: "product", y: "amount", series: "region", options: { ticks: "edges", valueAxis: "right" } },
  },
  "bar edges horizontal": {
    spec: {
      type: "bar",
      x: "host",
      y: "amount",
      series: "region",
      stacked: true,
      horizontal: true,
      options: { ticks: "edges", valueAxis: "right" },
    },
  },
  "bar edges negative one category": {
    spec: { type: "bar", x: "c", y: "v", series: "s", options: { ticks: "edges" } },
    rows: [
      { c: "a", s: "x", v: -3 },
      { c: "a", s: "y", v: 7 },
    ],
  },
  "bar edges empty": { spec: { type: "bar", x: "c", y: "v", options: { ticks: "edges" } }, rows: [] },
  "bar categories weekdays": {
    spec: { type: "bar", x: "d", y: "v", series: "s", options: { categories: "Sun|Mon|Tue|Wed|Thu|Fri|Sat" } },
    rows: [
      { d: "Wed", s: "a", v: 4 },
      { d: "Mon", s: "b", v: 2 },
      { d: "Mon", s: "a", v: 3 },
      { d: "Holiday", s: "c", v: 9 },
      { d: "Sat", s: "a", v: 1 },
    ],
  },
  "bar categories stacked horizontal limit": {
    spec: {
      type: "bar",
      x: "product",
      y: "amount",
      series: "region",
      stacked: true,
      horizontal: true,
      limit: 1,
      options: { categories: "Zeta|Pro|Basic|Pro", ticks: "edges" },
    },
  },
  "bar categories empty rows": {
    spec: { type: "bar", x: "d", y: "v", stacked: true, options: { categories: "a|b" } },
    rows: [],
  },
  "bar axes none inline": {
    spec: {
      type: "bar",
      x: "k",
      y: "v",
      series: "s",
      stacked: true,
      horizontal: true,
      height: 12,
      options: { axes: "none" },
    },
    rows: [
      { k: "all", s: "Paid", v: 60 },
      { k: "all", s: "Due", v: 25 },
      { k: "all", s: "Overdue", v: 15 },
    ],
  },
  "bar axes none vertical": {
    spec: { type: "bar", x: "product", y: "amount", series: "region", options: { axes: "none", valueAxis: "right" } },
  },
  "bar negative": {
    spec: { type: "bar", x: "c", y: "v" },
    rows: [
      { c: "a", v: -3 },
      { c: "b", v: 7 },
    ],
  },
};
