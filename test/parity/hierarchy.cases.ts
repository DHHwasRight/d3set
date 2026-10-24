import type { Cases } from "./types";

const t = (m: number) => new Date(Date.parse("2026-10-24T12:00:00Z") + m * 60_000).toISOString();

export const cases: Cases = {
  // treemap
  "treemap flat": { spec: { type: "treemap", x: "host", y: "amount" } },
  "treemap grouped": { spec: { type: "treemap", x: "product", y: "amount", series: "region" } },
  "treemap limit": { spec: { type: "treemap", x: "stage", y: "latency", limit: 3, aggregate: "avg", format: "$,.0f" } },
  "treemap empty": { spec: { type: "treemap", x: "host", y: "amount" }, rows: [] },
  "treemap empty grouped": { spec: { type: "treemap", x: "host", y: "amount", series: "region" }, rows: [] },
  "treemap small": {
    spec: { type: "treemap", x: "c", y: "v", height: 120 },
    rows: [
      { c: "a", v: 60 },
      { c: "b", v: 25 },
      { c: "c", v: 10 },
      { c: "d", v: 4 },
      { c: "e", v: -3 },
      { c: "f", v: 1 },
    ],
    width: 300,
  },
  "treemap small grouped": {
    spec: { type: "treemap", x: "c", y: "v", series: "g", height: 160 },
    rows: [
      { g: "x", c: "a", v: 6 },
      { g: "y", c: "b", v: 9 },
      { g: "x", c: "c", v: 3 },
      { g: "y", c: "a", v: 0 },
      { g: "z", c: "d", v: 1 },
    ],
    width: 250,
  },

  // funnel
  "funnel default": { spec: { type: "funnel", x: "stage", y: "seats" } },
  "funnel sorted": { spec: { type: "funnel", x: "stage", y: "seats", options: { sort: true } } },
  "funnel count": {
    spec: { type: "funnel", x: "region", y: "amount", aggregate: "count", height: 180, format: ",.0f" },
  },
  "funnel empty": { spec: { type: "funnel", x: "stage", y: "seats" }, rows: [] },
  "funnel small": {
    spec: { type: "funnel", x: "s", y: "n" },
    rows: [
      { s: "Visit", n: 1000 },
      { s: "Sign up", n: 400 },
      { s: "Visit", n: 200 },
      { s: "Pay", n: 0 },
    ],
  },

  // kpi
  "kpi plain": { spec: { type: "kpi", y: "amount" } },
  "kpi trend": { spec: { type: "kpi", x: "at", y: "amount", interval: "1m" } },
  "kpi trend auto": { spec: { type: "kpi", x: "at", y: "latency", interval: "auto", aggregate: "avg" } },
  "kpi trend raw": { spec: { type: "kpi", x: "at", y: "errors" } },
  "kpi thresholds": {
    spec: {
      type: "kpi",
      y: "amount",
      format: "$,.0f",
      thresholds: [
        { op: ">", value: 50000, level: "critical" },
        { op: ">", value: 10000, level: "warning" },
      ],
    },
  },
  "kpi empty": { spec: { type: "kpi", y: "amount" }, rows: [] },
  "kpi empty trend": { spec: { type: "kpi", x: "at", y: "amount", interval: "1m" }, rows: [] },
  "kpi small down": {
    spec: { type: "kpi", x: "t", y: "v", aggregate: "max", height: 100 },
    rows: [
      { t: 1, v: 10 },
      { t: 3, v: 4 },
      { t: 2, v: 12 },
      { t: 3, v: 6 },
    ],
  },
  "kpi small time": {
    spec: { type: "kpi", x: "t", y: "v", interval: "5m" },
    rows: [
      { t: t(0), v: 2 },
      { t: t(4), v: 3 },
      { t: t(6), v: 10 },
    ],
  },
  "kpi one point": { spec: { type: "kpi", x: "t", y: "v" }, rows: [{ t: 5, v: 7 }] },
  "kpi zero previous": {
    spec: { type: "kpi", x: "t", y: "v" },
    rows: [
      { t: 1, v: 0 },
      { t: 2, v: 5 },
    ],
  },

  // slo
  "slo latency": { spec: { type: "slo", y: "latency", objective: { good: { op: "<=", value: 300 }, target: 99 } } },
  "slo ok": {
    spec: { type: "slo", y: "latency", objective: { good: { op: "<", value: 1000 }, target: 95 }, height: 80 },
  },
  "slo empty": {
    spec: { type: "slo", y: "latency", objective: { good: { op: "<=", value: 300 }, target: 99 } },
    rows: [],
  },
  "slo small warning": {
    spec: { type: "slo", y: "v", objective: { good: { op: ">=", value: 1 }, target: 90 } },
    rows: [
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 1 },
      { v: 0 },
      { v: "x" },
    ],
  },

  // note
  "note paragraphs": { spec: { type: "note", text: "First paragraph\nstill first.\n\n  Second paragraph.  " } },
  "note empty": { spec: { type: "note" }, rows: [] },
};
