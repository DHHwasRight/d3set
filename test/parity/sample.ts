import type { Row } from "../../src/index";

// Deterministic sample rows: fixed times, no randomness.
const regions = ["EU", "US", "APAC", "LATAM"];
const products = ["Starter", "Pro", "Enterprise"];
const hosts = ["host-1", "host-2", "host-10", "host-3"];
const start = Date.parse("2026-10-24T12:00:00Z");
export const sampleRows: Row[] = Array.from({ length: 120 }, (_, i) => ({
  at: new Date(start + i * 15_000).toISOString(),
  region: regions[(i * 7) % 4]!,
  product: products[(i * 5) % 3]!,
  host: hosts[(i * 3) % 4]!,
  amount: 20 + ((i * 37) % 480),
  latency: 40 + ((i * 53) % 700),
  seats: 1 + ((i * 11) % 50),
  errors: i % 9 === 0 ? 1 : 0,
  level: ["info", "warn", "error"][i % 3 === 0 ? (i % 2) * 2 : 0]!,
  check: ["ok", "ok", "warning", "critical"][(i * 3) % 4]!,
  stage: ["Visited", "Signed up", "Trial", "Paid"][Math.min(3, ((i * 13) % 7) >> 1)]!,
  message: `GET /api/${products[i % 3]!.toLowerCase()} ${200 + (i % 9 === 0 ? 300 : 0)}`,
}));
