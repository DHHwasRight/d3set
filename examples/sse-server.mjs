// Demo SSE server: streams fake sales events. No dependencies.
// Supports server-side filters: ?region=EU&region=US&amount_min=100
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8787);
const regions = ["EU", "US", "APAC", "LATAM"];
const products = ["Starter", "Pro", "Enterprise"];
const customers = ["Acme", "Globex", "Initech", "Umbrella", "Hooli", "Stark", "Wayne"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

let seq = 0;
const makeSale = (at = new Date()) => ({
  id: ++seq,
  at: at.toISOString(),
  minute: at.toISOString().slice(0, 16),
  region: pick(regions),
  product: pick(products),
  customer: pick(customers),
  amount: Math.round(20 + Math.random() * 480),
  seats: 1 + Math.floor(Math.random() ** 2 * 50),
  // Each event reached one funnel stage. Later stages are rarer.
  stage: pick([
    "Visited",
    "Visited",
    "Visited",
    "Visited",
    "Signed up",
    "Signed up",
    "Signed up",
    "Trial",
    "Trial",
    "Paid",
  ]),
});

// History at the same rate as the live stream (one sale every 700 ms), so charts do not jump.
const SALE_MS = 700;
const history = [];
for (let i = 0; i < 2000; i++) history.push(makeSale(new Date(Date.now() - (2000 - i) * SALE_MS)));

// Observability demo: request logs from hosts.
const services = ["api", "web", "worker", "billing"];
const hosts = Array.from({ length: 24 }, (_, i) => ({
  name: `host-${String(i + 1).padStart(2, "0")}`,
  service: services[i % 4],
  region: regions[i % 3],
  slow: 1 + Math.random() * 2,
}));
let reqId = 0;
const makeRequest = (at = new Date()) => {
  const host = pick(hosts);
  // Log-normal latency; some hosts are slower.
  const latency = Math.round(Math.exp(4.2 + Math.random() * 0.9 + (Math.random() < 0.05 ? 1.5 : 0)) * host.slow);
  const error = Math.random() < 0.03 + (latency > 600 ? 0.2 : 0);
  return {
    id: ++reqId,
    at: at.toISOString(),
    host: host.name,
    service: host.service,
    region: host.region,
    latency,
    status: error ? 500 : 200,
    errors: error ? 1 : 0,
    level: error ? "error" : latency > 400 ? "warn" : "info",
    check: error ? "critical" : latency > 400 ? "warning" : "ok",
    message: `${pick(["GET", "POST", "PUT"])} /${host.service}/${pick(["invoices", "customers", "events", "plans"])} ${error ? 500 : 200} ${latency}ms`,
  };
};
// History at the live rate: 2.5 requests every 500 ms on average, for 20 minutes.
const ops = [];
for (let i = 0; i < 6000; i++) ops.push(makeRequest(new Date(Date.now() - (6000 - i) * 200)));
const opsClients = new Set();

const clients = new Set();

function matches(sale, q) {
  const regionsQ = q.getAll("region");
  if (regionsQ.length && !regionsQ.includes(sale.region)) return false;
  if (q.has("amount_min") && sale.amount < Number(q.get("amount_min"))) return false;
  if (q.has("amount_max") && sale.amount > Number(q.get("amount_max"))) return false;
  return true;
}

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/stream" && url.pathname !== "/ops") {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  if (url.pathname === "/ops") {
    opsClients.add(res);
    res.write(`data: ${JSON.stringify({ op: "replace", rows: ops })}\n\n`);
    req.on("close", () => opsClients.delete(res));
    return;
  }
  const client = { res, q: url.searchParams };
  clients.add(client);
  // Initial snapshot: the envelope tells the client to replace its rows.
  res.write(`data: ${JSON.stringify({ op: "replace", rows: history.filter((s) => matches(s, client.q)) })}\n\n`);
  req.on("close", () => clients.delete(client));
}).listen(PORT, () => console.log(`SSE demo: http://localhost:${PORT}/stream`));

setInterval(() => {
  const sale = makeSale();
  history.push(sale);
  if (history.length > 2000) history.shift();
  for (const c of clients) if (matches(sale, c.q)) c.res.write(`data: ${JSON.stringify(sale)}\n\n`);
}, SALE_MS);

setInterval(() => {
  const batch = Array.from({ length: 1 + Math.floor(Math.random() * 4) }, () => makeRequest());
  ops.push(...batch);
  if (ops.length > 8000) ops.splice(0, ops.length - 8000);
  for (const res of opsClients) res.write(`data: ${JSON.stringify(batch)}\n\n`);
}, 500);
