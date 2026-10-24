import {
  createDashboard,
  createTheme,
  darkTheme,
  lightTheme,
  multiSelect,
  range,
  search,
  select,
  sseSource,
  type ChartSpec,
} from "../src/index";

const STREAM = "http://localhost:8787/stream";

// A brand theme: override only the tokens you need.
const series = ["#e11d48", "#f97316", "#0891b2", "#65a30d"];
const brand = createTheme({ name: "brand", color: { accent: "#e11d48", series } }, lightTheme);
const brandDark = createTheme({ name: "brand-dark", color: { accent: "#fb7185", series } }, darkTheme);

const charts: ChartSpec[] = [
  { type: "kpi", title: "Revenue", y: "amount", format: "$,.0f" },
  { type: "kpi", title: "Orders", y: "amount", aggregate: "count" },
  { type: "line", title: "Revenue per minute", x: "minute", y: "amount", series: "region", aggregate: "sum" },
  { type: "bar", title: "Revenue by product", x: "product", y: "amount", series: "region" },
];

const client = createDashboard(document.getElementById("client")!, {
  theme: brand,
  source: sseSource({ url: STREAM, maxRows: 2000 }),
  filters: [multiSelect("region"), select("product"), range("amount", { min: 0 }), search("customer")],
  charts,
});

const server = createDashboard(document.getElementById("server")!, {
  theme: brand,
  filterMode: "server",
  source: sseSource({ url: STREAM, maxRows: 2000 }),
  filters: [multiSelect("region", { options: ["EU", "US", "APAC", "LATAM"] }), range("amount")],
  charts: charts.slice(2),
});

let dark = false;
document.getElementById("theme")!.addEventListener("click", () => {
  dark = !dark;
  document.body.classList.toggle("dark", dark);
  const t = dark ? brandDark : brand;
  client.setTheme(t);
  server.setTheme(t);
});
