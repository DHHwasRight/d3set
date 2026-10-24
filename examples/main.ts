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
const series = ["#e11d48", "#f97316", "#0891b2", "#65a30d", "#7c3aed"];
const brand = createTheme(
  { name: "brand", color: { accent: "#e11d48", series, sequential: ["#fff1f2", "#9f1239"] } },
  lightTheme,
);
const brandDark = createTheme(
  { name: "brand-dark", color: { accent: "#fb7185", series, sequential: ["#4c0519", "#fda4af"] } },
  darkTheme,
);

const charts: ChartSpec[] = [
  { type: "kpi", title: "Revenue", x: "minute", y: "amount", format: "$,.0f" },
  { type: "kpi", title: "Orders", x: "minute", y: "amount", aggregate: "count" },
  { type: "gauge", title: "Average order", y: "amount", aggregate: "avg", min: 0, max: 500, format: "$,.0f" },
  {
    type: "line",
    title: "Revenue per minute (line)",
    x: "minute",
    y: "amount",
    series: "region",
    aggregate: "sum",
    span: 2,
  },
  { type: "donut", title: "Revenue by region (donut)", x: "region", y: "amount" },
  {
    type: "area",
    title: "Revenue per minute (stacked area)",
    x: "minute",
    y: "amount",
    series: "product",
    aggregate: "sum",
    span: 2,
  },
  { type: "pie", title: "Orders by product (pie)", x: "product", y: "amount", aggregate: "count" },
  { type: "bar", title: "Revenue by product (grouped bar)", x: "product", y: "amount", series: "region" },
  {
    type: "bar",
    title: "Revenue by customer (stacked, horizontal)",
    x: "customer",
    y: "amount",
    series: "region",
    stacked: true,
    horizontal: true,
  },
  {
    type: "funnel",
    title: "Conversion (funnel)",
    x: "stage",
    y: "amount",
    aggregate: "count",
    options: { sort: true },
  },
  {
    type: "scatter",
    title: "Seats vs amount (bubble)",
    x: "seats",
    y: "amount",
    size: "seats",
    series: "product",
    limit: 300,
  },
  { type: "histogram", title: "Order size (histogram)", y: "amount", bins: 15, format: "$~s" },
  { type: "boxplot", title: "Order size by region (box plot)", x: "region", y: "amount", format: "$~s" },
  {
    type: "heatmap",
    title: "Revenue, customer × region (heatmap)",
    x: "customer",
    series: "region",
    y: "amount",
    span: 2,
  },
  { type: "treemap", title: "Revenue by region › product (treemap)", x: "product", series: "region", y: "amount" },
  {
    type: "table",
    title: "Top customers (grouped table)",
    x: "customer",
    y: "amount",
    aggregate: "sum",
    format: "$,.0f",
  },
  {
    type: "table",
    title: "Latest orders (table)",
    span: 2,
    limit: 50,
    columns: [
      { field: "id" },
      { field: "at", label: "Time" },
      { field: "customer" },
      { field: "region" },
      { field: "product" },
      { field: "amount", format: "$,.0f" },
    ],
  },
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
  charts: [charts[3]!, charts[7]!],
});

const OPS = "http://localhost:8787/ops";
const latencyRules = [
  { op: ">" as const, value: 500, level: "critical" as const },
  { op: ">" as const, value: 250, level: "warning" as const },
];

const ops = createDashboard(document.getElementById("ops")!, {
  theme: brand,
  source: sseSource({ url: OPS, maxRows: 8000 }),
  filters: [multiSelect("service"), select("region"), select("host"), search("message")],
  charts: [
    { type: "kpi", title: "Requests", x: "at", y: "id", aggregate: "count", interval: "1m" },
    { type: "kpi", title: "Avg latency (ms)", y: "latency", aggregate: "avg", thresholds: latencyRules },
    {
      type: "slo",
      title: "Latency SLO (≤ 500 ms)",
      y: "latency",
      objective: { good: { op: "<=", value: 500 }, target: 95 },
    },
    {
      type: "timeseries",
      title: "Requests by service",
      x: "at",
      y: "id",
      series: "service",
      aggregate: "count",
      display: "bars",
      span: 2,
    },
    {
      type: "toplist",
      title: "Slowest hosts (avg ms)",
      x: "host",
      y: "latency",
      aggregate: "avg",
      thresholds: latencyRules,
    },
    {
      type: "timeseries",
      title: "Avg latency by service",
      x: "at",
      y: "latency",
      series: "service",
      aggregate: "avg",
      thresholds: latencyRules,
      span: 2,
    },
    {
      type: "change",
      title: "Errors, last 5 min",
      x: "at",
      y: "errors",
      series: "service",
      window: "5m",
      decreaseIsGood: true,
    },
    { type: "timeheatmap", title: "Latency distribution", x: "at", y: "latency", bins: 12, span: 2 },
    {
      type: "hostmap",
      title: "Host map (avg latency)",
      x: "host",
      y: "latency",
      aggregate: "avg",
      series: "service",
      thresholds: [...latencyRules, { op: ">=", value: 0, level: "ok" }],
    },
    { type: "status", title: "Host checks", x: "host", y: "check", series: "at", span: 2 },
    {
      type: "sunburst",
      title: "Requests, region › service",
      x: "service",
      series: "region",
      y: "id",
      aggregate: "count",
    },
    {
      type: "stream",
      title: "Log stream",
      x: "at",
      y: "message",
      series: "level",
      columns: [{ field: "host" }],
      limit: 100,
      span: 2,
    },
    {
      type: "note",
      title: "About",
      text: "Live request logs from 24 hosts, pushed with server-sent events.\n\nThresholds: warning above 250 ms, critical above 500 ms.",
    },
  ],
});

let dark = false;
document.getElementById("theme")!.addEventListener("click", () => {
  dark = !dark;
  document.body.classList.toggle("dark", dark);
  const t = dark ? brandDark : brand;
  ops.setTheme(t);
  client.setTheme(t);
  server.setTheme(t);
});
