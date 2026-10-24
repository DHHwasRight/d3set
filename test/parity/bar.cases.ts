import type { Cases } from "./types";

export const cases: Cases = {
  "bar grouped": { spec: { type: "bar", x: "product", y: "amount", series: "region" } },
  "bar stacked horizontal": {
    spec: { type: "bar", x: "host", y: "amount", series: "region", stacked: true, horizontal: true },
  },
  "bar limit": { spec: { type: "bar", x: "host", y: "latency", limit: 3, format: "$,.0f" } },
  "bar negative": {
    spec: { type: "bar", x: "c", y: "v" },
    rows: [
      { c: "a", v: -3 },
      { c: "b", v: 7 },
    ],
  },
};
