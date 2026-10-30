import type { Page } from "@playwright/test";

/** Every chart type the gallery documents. */
export const KINDS = [
  "timeseries",
  "line",
  "area",
  "bar",
  "toplist",
  "change",
  "table",
  "pie",
  "donut",
  "treemap",
  "sunburst",
  "funnel",
  "histogram",
  "boxplot",
  "heatmap",
  "timeheatmap",
  "scatter",
  "kpi",
  "gauge",
  "slo",
  "hostmap",
  "status",
  "stream",
  "note",
];

/** Every page the gallery serves. */
export const ALL_PAGES = [
  "/",
  "/guide",
  "/dashboards/ops",
  "/dashboards/sales",
  ...KINDS.map((k) => `/charts/${k}`),
  "/analytics",
];

/** The views of the Analytics page, by tab, and their number of sections. */
export const ANALYTICS: [tab: string, views: [id: string, name: string, charts: number][]][] = [
  [
    "Subscriptions",
    [
      ["subscriptions-active", "Active subscriptions", 5],
      ["subscriptions-new", "New subscriptions", 6],
      ["subscriptions-churn", "Churn", 6],
    ],
  ],
  [
    "Revenue",
    [
      ["revenue-streams", "Revenue streams", 5],
      ["revenue-mrr", "MRR", 5],
    ],
  ],
  ["Credit ledgers", [["credit-ledgers", "Credit ledgers", 5]]],
  ["Usage", [["usage", "Usage", 9]]],
  [
    "Cash collection",
    [
      ["payments", "Payments", 6],
      ["dunnings", "Dunnings", 6],
    ],
  ],
  ["Invoices", [["invoices", "Invoices", 8]]],
];

/** Pages every check visits: one of each layout. */
export const PAGES = ["/", "/charts/bar", "/charts/kpi", "/charts/table", "/dashboards/sales", "/guide"];

/** Open a page. The stream never goes idle, so wait for `load`, then for hydration. */
export async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForFunction(
      () => !document.querySelector("[data-d3s-dashboard] .d3s-payload, [data-d3s-chart] .d3s-payload"),
      null,
      { timeout: 10_000 },
    )
    .catch(() => {});
}

type Box = { x: number; y: number; w: number; h: number };

/** Boxes of the parts of the shell and the page, to compare two renders of a page. */
export async function landmarks(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    const box = (name: string, el: Element | null) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      out[name] = {
        x: Math.round(r.x),
        y: Math.round(r.y + window.scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    };
    box("header", document.querySelector(".top"));
    box("sidebar", document.querySelector(".side"));
    box("main", document.querySelector(".main"));
    box("content", document.querySelector(".page"));
    box("h1", document.querySelector("h1"));
    box("lead", document.querySelector(".lead"));
    document.querySelectorAll(".page > h2, .example > h2").forEach((e, i) => box(`h2[${i}]`, e));
    document
      .querySelectorAll(".figure, .thumb, .pane, .dashboard, .block, details.code")
      .forEach((e, i) => box(`${e.className.split(" ")[0]}[${i}]`, e));
    document.querySelectorAll(".d3s-card").forEach((e, i) => box(`card[${i}]`, e));
    document.querySelectorAll(".d3s-chart svg").forEach((e, i) => box(`svg[${i}]`, e));
    return out;
  });
}

/** Rows "name: a vs b" for every box that differs by more than `tolerance` pixels. */
export function diff(a: Record<string, Box>, b: Record<string, Box>, tolerance = 1): string[] {
  const out: string[] = [];
  for (const k of Object.keys(a)) {
    const p = a[k]!;
    const q = b[k];
    if (!q) {
      out.push(`${k}: missing`);
      continue;
    }
    const d = (["x", "y", "w", "h"] as const).filter((c) => Math.abs(p[c] - q[c]) > tolerance);
    if (d.length) out.push(`${k}: ${d.map((c) => `${c} ${p[c]}→${q[c]}`).join(", ")}`);
  }
  return out;
}
