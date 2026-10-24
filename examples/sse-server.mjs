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
  stage: pick(["Visited", "Visited", "Visited", "Visited", "Signed up", "Signed up", "Signed up", "Trial", "Trial", "Paid"]),
});

// Last 30 minutes of history.
const history = [];
for (let i = 0; i < 300; i++) history.push(makeSale(new Date(Date.now() - (300 - i) * 6000)));

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
  if (url.pathname !== "/stream") {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
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
}, 700);
