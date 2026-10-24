import type { Cases } from "./types";

const t0 = Date.parse("2026-10-24T12:00:00Z");
const at = (min: number) => new Date(t0 + min * 60_000).toISOString();

export const cases: Cases = {
  // table
  "table raw columns formats thresholds": {
    spec: {
      type: "table",
      limit: 12,
      columns: [
        { field: "host", label: "Host" },
        {
          field: "amount",
          label: "Amount",
          format: "$,.0f",
          thresholds: [
            { op: ">", value: 400, level: "critical" },
            { op: ">", value: 200, color: "#123456" },
          ],
        },
        { field: "latency", format: ".3~s", align: "left", thresholds: [{ op: ">=", value: 500, level: "warning" }] },
        { field: "level" },
        { field: "missing", label: "Nothing" },
      ],
    },
  },
  "table raw no columns": { spec: { type: "table" } },
  "table raw hand-made": {
    spec: { type: "table" },
    rows: [
      { name: "a", n: 1.5, ok: true, note: null },
      { name: "b", n: "7", ok: false, extra: 3 },
      { name: "c", n: -2 },
    ],
  },
  "table group": {
    spec: {
      type: "table",
      x: "region",
      y: "amount",
      aggregate: "sum",
      format: ",.0f",
      thresholds: [{ op: ">", value: 8000, level: "warning" }],
    },
  },
  "table group series": {
    spec: { type: "table", x: "region", series: "product", y: "latency", aggregate: "avg", limit: 5 },
  },
  "table group count no y": { spec: { type: "table", x: "host", aggregate: "count" } },
  "table empty": { spec: { type: "table" }, rows: [] },
  "table group empty": { spec: { type: "table", x: "host", y: "amount", aggregate: "sum" }, rows: [] },

  // toplist
  "toplist default": { spec: { type: "toplist", x: "host", y: "amount" } },
  "toplist thresholds": {
    spec: {
      type: "toplist",
      x: "region",
      y: "latency",
      aggregate: "avg",
      format: ",.1f",
      thresholds: [
        { op: ">", value: 380, level: "critical" },
        { op: ">", value: 300, level: "warning" },
      ],
    },
  },
  "toplist ascending limit": {
    spec: { type: "toplist", x: "product", y: "seats", limit: 2, options: { ascending: true } },
  },
  "toplist hand-made": {
    spec: { type: "toplist", x: "c", y: "v" },
    rows: [
      { c: "a", v: -3 },
      { c: "b", v: 7 },
      { c: "a", v: 1 },
      { c: "z", v: 0 },
    ],
  },
  "toplist empty": { spec: { type: "toplist", x: "host", y: "amount" }, rows: [] },

  // change
  "change default": { spec: { type: "change", x: "at", y: "amount", series: "region" } },
  "change window decreaseIsGood": {
    spec: {
      type: "change",
      x: "at",
      y: "latency",
      series: "host",
      window: "5m",
      decreaseIsGood: true,
      aggregate: "avg",
      format: ",.1f",
    },
  },
  "change no series": { spec: { type: "change", x: "at", y: "errors", window: "10m", aggregate: "count" } },
  "change hand-made": {
    spec: { type: "change", x: "t", y: "v", series: "g", window: "5m", limit: 3 },
    rows: [
      { t: at(0), g: "a", v: 10 },
      { t: at(1), g: "b", v: 0 },
      { t: at(2), g: "c", v: 4 },
      { t: at(3), g: "d", v: 9 },
      { t: at(6), g: "a", v: 5 },
      { t: at(7), g: "b", v: 3 },
      { t: at(8), g: "c", v: 4 },
      { t: at(9), g: "d", v: 9.5 },
      { t: at(9), g: "e", v: 1 },
      { t: "not a date", g: "f", v: 1 },
    ],
  },
  "change empty": { spec: { type: "change", x: "at", y: "amount", series: "region" }, rows: [] },

  // hostmap
  "hostmap default": { spec: { type: "hostmap", x: "host", y: "latency" } },
  "hostmap series": { spec: { type: "hostmap", x: "host", y: "amount", series: "region", aggregate: "avg" } },
  "hostmap thresholds": {
    spec: {
      type: "hostmap",
      x: "host",
      y: "latency",
      series: "product",
      aggregate: "max",
      thresholds: [
        { op: ">", value: 700, level: "critical" },
        { op: ">", value: 600, level: "warning" },
      ],
    },
  },
  "hostmap one value": {
    spec: { type: "hostmap", x: "h", y: "v" },
    rows: [
      { h: "b", v: 2 },
      { h: "a", v: 2 },
    ],
  },
  "hostmap empty": { spec: { type: "hostmap", x: "host", y: "latency" }, rows: [] },
  "hostmap series empty": { spec: { type: "hostmap", x: "host", y: "latency", series: "region" }, rows: [] },

  // status
  "status levels": { spec: { type: "status", x: "host", y: "check", series: "at" } },
  "status thresholds": {
    spec: {
      type: "status",
      x: "region",
      y: "latency",
      series: "at",
      format: ",.0f",
      thresholds: [
        { op: ">", value: 600, level: "critical" },
        { op: ">", value: 300, level: "warning" },
      ],
    },
  },
  "status hand-made": {
    spec: { type: "status", x: "name", y: "s", thresholds: [{ op: ">", value: 5 }] },
    rows: [
      { name: "svc-10", s: "ok" },
      { name: "svc-2", s: 9 },
      { name: "svc-1", s: "warning" },
      { name: "svc-10", s: "critical" },
      { name: "Svc-3", s: "unknown" },
      { name: "svc-4", s: null },
    ],
  },
  "status empty": { spec: { type: "status", x: "host", y: "check" }, rows: [] },

  // stream
  "stream level columns limit": {
    spec: {
      type: "stream",
      x: "at",
      y: "message",
      series: "level",
      limit: 15,
      columns: [{ field: "host" }, { field: "amount", label: "amt" }],
    },
  },
  "stream default": { spec: { type: "stream", x: "at", y: "message" } },
  "stream hand-made": {
    spec: { type: "stream", x: "t", y: "m", series: "lvl", columns: [{ field: "k" }] },
    rows: [
      { t: at(0), m: "boot", lvl: "DEBUG", k: 1 },
      { t: 12345, m: "raw time", lvl: "Weird" },
      { t: at(2), m: null, lvl: "" },
      { m: "no time", lvl: "ok", k: null },
    ],
  },
  "stream empty": { spec: { type: "stream", x: "at", y: "message", series: "level" }, rows: [] },
};
