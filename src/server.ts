// Server rendering in JavaScript: the markup and payload `hydrate()` reads, built by running the
// same chart code against a server-side DOM (linkedom). The first frame is therefore exactly the
// browser's first frame at the same width, which is what the Rust renderer (d3set-ssr) works to
// reproduce by porting each chart.
//
//   import { renderDashboard } from "d3set/server";
//   const html = renderDashboard({ charts, rows, width: 960, stream: "/events/sales" });
//
// Rendering is synchronous. Every built-in chart type is registered on the server: bundle size
// does not matter there. A custom type is registered with `registerChart` from "d3set/core".

import { parseHTML } from "linkedom";
import { registerBuiltInCharts } from "./charts/index";
import { createChart } from "./chart";
import type { ChartSpec } from "./charts/types";
import { createDashboard } from "./dashboard";
import type { ControlClasses } from "./classes";
import { staticSource } from "./data/static";
import type { Row } from "./data/types";
import type { FilterDef } from "./filters/filters";
import type { ChartPayload, DashboardPayload, StreamOption } from "./hydrate";
import { lightTheme, type Theme } from "./theme/theme";

/**
 * A live source for the hydrated page: server-sent events at `url`, or with `transport: "poll"` a
 * JSON file fetched again and again.
 */
export type { StreamOption };

export interface RenderChartOptions {
  spec: ChartSpec;
  rows?: Row[];
  theme?: Theme;
  /** Width the chart is drawn at, in CSS px. The SVG scales to its container until hydration. */
  width?: number;
  /** Follow server-sent events after hydration. Without it, the chart keeps `rows`. */
  stream?: StreamOption;
  /** Write the payload `hydrate()` reads. `false`: static markup, no client code needed. */
  payload?: boolean;
}

export interface RenderDashboardOptions {
  charts: ChartSpec[];
  filters?: FilterDef[];
  rows?: Row[];
  theme?: Theme;
  /** Width of the dashboard in CSS px: the cards are sized like the CSS grid will size them. */
  width?: number;
  stream?: StreamOption;
  filterMode?: "client" | "server";
  timeField?: string;
  timeWindow?: string;
  /** When the rows were drawn (ms since the epoch): the time window counts from it. */
  now?: number;
  /** Extra class names for the controls and cards (see `ControlClasses`). */
  classes?: ControlClasses;
  /** Write the payload `hydrate()` reads. `false`: static markup, no client code needed. */
  payload?: boolean;
}

registerBuiltInCharts();

const GLOBALS = ["document", "window", "HTMLElement", "Element", "Node", "SVGElement"] as const;

/**
 * Run `fn` with a DOM as the global `document`. In Node, a server-side DOM, and the globals are
 * restored after. Where a DOM already exists (a browser, a test environment), that one.
 */
function withDom<T>(fn: (doc: Document) => T): T {
  if (typeof globalThis.document !== "undefined") return fn(globalThis.document);
  const { window, document } = parseHTML("<!doctype html><html><head></head><body></body></html>");
  const g = globalThis as Record<string, unknown>;
  const saved = GLOBALS.map((k) => [k, g[k], k in g] as const);
  const w = window as unknown as Record<string, unknown>;
  for (const k of GLOBALS) g[k] = k === "window" ? window : k === "document" ? document : w[k];
  try {
    return fn(document as unknown as Document);
  } finally {
    for (const [k, v, had] of saved) {
      if (had) g[k] = v;
      else delete g[k];
    }
  }
}

/**
 * The SVGs scale to their container until hydration redraws them at the real width, like the
 * Rust renderer's `Svg`: `width="100%"` with the drawn size as the view box.
 */
function responsive(root: Element) {
  for (const svg of root.querySelectorAll("svg")) {
    const w = svg.getAttribute("width");
    const h = svg.getAttribute("height");
    if (!w || !h || w.endsWith("%")) continue;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
    svg.setAttribute("width", "100%");
  }
}

/** JSON that cannot close its `<script>` element. */
export function scriptSafe(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function payloadScript(doc: Document, payload: unknown): HTMLScriptElement {
  const script = doc.createElement("script");
  script.type = "application/json";
  script.className = "d3s-payload";
  script.textContent = scriptSafe(JSON.stringify(payload));
  return script;
}

/** One chart as a `<figure data-d3s-chart>` with its payload: `hydrate()` makes it live. */
export function renderChart(opts: RenderChartOptions): string {
  const theme = opts.theme ?? lightTheme;
  return withDom((doc) => {
    const figure = doc.createElement("figure");
    figure.className = "d3s-figure";
    const mounted = createChart(figure, {
      spec: opts.spec,
      rows: opts.rows ?? [],
      theme: { ...theme, motion: 0 },
      width: opts.width ?? 640,
    });
    responsive(figure);
    const payload: ChartPayload = { spec: opts.spec, rows: opts.rows ?? [], theme, stream: opts.stream };
    if (opts.payload !== false) {
      figure.setAttribute("data-d3s-chart", "");
      figure.append(payloadScript(doc, payload));
    }
    const html = figure.outerHTML;
    mounted.destroy();
    return html;
  });
}

/** A dashboard as a `<div data-d3s-dashboard>` with its payload: `hydrate()` makes it live. */
export function renderDashboard(opts: RenderDashboardOptions): string {
  const theme = opts.theme ?? lightTheme;
  return withDom((doc) => {
    const root = doc.createElement("div");
    const rows = opts.rows ?? [];
    const dashboard = createDashboard(root, {
      source: staticSource(rows),
      charts: opts.charts,
      filters: opts.filters,
      filterMode: opts.filterMode,
      timeField: opts.timeField,
      timeWindow: opts.timeWindow,
      now: opts.now,
      classes: opts.classes,
      theme: { ...theme, motion: 0 },
      width: opts.width ?? 960,
    });
    responsive(root);
    const payload: DashboardPayload = {
      charts: opts.charts,
      filters: opts.filters,
      filterMode: opts.filterMode,
      timeField: opts.timeField,
      timeWindow: opts.timeWindow,
      now: opts.now,
      classes: opts.classes,
      rows,
      theme,
      stream: opts.stream,
    };
    if (opts.payload !== false) {
      root.setAttribute("data-d3s-dashboard", "");
      root.append(payloadScript(doc, payload));
    }
    const html = root.outerHTML;
    dashboard.destroy();
    return html;
  });
}

export { sseResponse, type SseMessage, type SseResponseOptions } from "./sse-response";
