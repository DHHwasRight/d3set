// Sample orders: a seeded history, then new orders as the stream runs.
import type { ChartSpec, FilterDef, Row } from "d3set/core";

const REGIONS = ["APAC", "EU", "LATAM", "US"];
const PRODUCTS = ["Starter", "Pro", "Enterprise"];

function order(id: number, at: number, seed: number): Row {
  const r = Math.abs(Math.sin(seed * 9301 + 49297)) % 1;
  return {
    id,
    at: new Date(at).toISOString(),
    region: REGIONS[Math.floor(r * 4)]!,
    product: PRODUCTS[Math.floor((r * 10) % 3)]!,
    amount: Math.round(20 + r * 480),
  };
}

/** The last 10 minutes of orders, one every 4 seconds. */
export function history(now = Date.now()): Row[] {
  return Array.from({ length: 150 }, (_, i) => order(i, now - (150 - i) * 4000, i));
}

/** New orders, a batch every second, until the client goes away. */
export async function* live(signal?: AbortSignal): AsyncGenerator<Row[]> {
  let id = 1_000_000;
  while (!signal?.aborted) {
    await new Promise((r) => setTimeout(r, 1000));
    yield Array.from({ length: 2 }, () => order(id++, Date.now(), id));
  }
}

export const charts: ChartSpec[] = [
  { type: "kpi", title: "Revenue", y: "amount", format: "$,.0f" },
  { type: "kpi", title: "Orders", y: "id", aggregate: "count" },
  {
    type: "line",
    title: "Revenue per minute",
    x: "at",
    y: "amount",
    series: "region",
    aggregate: "sum",
    interval: "1m",
    span: 2,
  },
  { type: "donut", title: "Revenue by region", x: "region", y: "amount" },
  { type: "bar", title: "Revenue by product", x: "product", y: "amount", series: "region", stacked: true, span: 2 },
];

export const filters: FilterDef[] = [
  { type: "select", id: "region", field: "region", label: "Region", param: "region", multiple: false },
  { type: "select", id: "product", field: "product", label: "Product", param: "product", multiple: false },
];
