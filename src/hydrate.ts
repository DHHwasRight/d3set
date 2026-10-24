import { getChart } from "./charts/registry";
import type { Chart, ChartSpec } from "./charts/types";
import { createDashboard, type Dashboard } from "./dashboard";
import { sseSource } from "./data/sse";
import { staticSource } from "./data/static";
import type { DataSource, MergeMode, Row } from "./data/types";
import type { FilterDef } from "./filters/filters";
import { applyTheme, darkTheme, lightTheme, type Theme } from "./theme/theme";

/** What a server writes into `<script type="application/json" class="d3s-payload">`. */
interface Payload {
  /** A full theme (the server's tokens), or the name of a built-in theme. */
  theme?: Theme | string;
  rows?: Row[];
  /** Live rows over SSE. With `key`, rows upsert by that field (a replayed catch-up does not count twice). */
  stream?: string | { url: string; maxRows?: number; mode?: MergeMode; key?: string };
}

export interface DashboardPayload extends Payload {
  charts: ChartSpec[];
  filters?: FilterDef[];
  filterMode?: "client" | "server";
  timeField?: string;
  timeWindow?: string;
}

export interface ChartPayload extends Payload {
  spec: ChartSpec;
}

export interface HydrateOptions {
  /** Themes by name, for payloads that name a theme instead of carrying one. */
  themes?: Record<string, Theme>;
}

export interface Hydrated {
  dashboards: Dashboard[];
  charts: Chart[];
  /** Stop every live source and remove the charts. */
  destroy(): void;
}

function readPayload<T>(el: Element): T | undefined {
  const script = el.querySelector(":scope > script.d3s-payload");
  if (!script?.textContent) return undefined;
  try {
    return JSON.parse(script.textContent) as T;
  } catch (err) {
    console.warn("d3set: hydrate: cannot read the payload, element skipped.", err);
    return undefined;
  }
}

function themeOf(p: Payload, opts: HydrateOptions): Theme {
  if (p.theme && typeof p.theme === "object") return p.theme;
  const name = p.theme ?? "light";
  return opts.themes?.[name] ?? (name === "dark" ? darkTheme : lightTheme);
}

function sourceOf(p: Payload): DataSource {
  const rows = p.rows ?? [];
  if (!p.stream) return staticSource(rows);
  const s = typeof p.stream === "string" ? { url: p.stream } : p.stream;
  return sseSource({ url: s.url, maxRows: s.maxRows, mode: s.mode, key: s.key, initial: rows });
}

/**
 * Turn server-rendered d3set markup into live charts.
 *
 * - `[data-d3s-dashboard]`: a dashboard with filters, cross-filtering, and the time window.
 * - `[data-d3s-chart]`: one chart.
 *
 * Each element carries its spec and rows as JSON. With a `stream` URL, the rows then follow
 * server-sent events. The server markup is replaced in the same task as the first draw, with
 * no transition, so nothing flashes or moves. An element without a payload stays static.
 */
export function hydrate(root: ParentNode = document, opts: HydrateOptions = {}): Hydrated {
  const dashboards: Dashboard[] = [];
  const charts: Chart[] = [];
  const sources: DataSource[] = [];

  for (const el of root.querySelectorAll<HTMLElement>("[data-d3s-dashboard]")) {
    const p = readPayload<DashboardPayload>(el);
    if (!p) continue;
    const source = sourceOf(p);
    sources.push(source);
    dashboards.push(
      createDashboard(el, {
        source,
        charts: p.charts,
        filters: p.filters,
        filterMode: p.filterMode,
        timeField: p.timeField,
        timeWindow: p.timeWindow,
        theme: themeOf(p, opts),
        hydrate: true,
      }),
    );
    delete el.dataset.d3sDashboard;
  }

  for (const el of root.querySelectorAll<HTMLElement>("[data-d3s-chart]")) {
    const p = readPayload<ChartPayload>(el);
    if (!p) continue;
    const theme = themeOf(p, opts);
    const body = document.createElement("div");
    el.replaceChildren(body);
    applyTheme(el, theme);
    const chart = getChart(p.spec.type)(body, p.spec, { theme: { ...theme, motion: 0 } });
    const source = sourceOf(p);
    sources.push(source);
    source.subscribe((rows) => chart.update(rows));
    chart.setTheme(theme);
    charts.push(chart);
    delete el.dataset.d3sChart;
  }

  return {
    dashboards,
    charts,
    destroy() {
      sources.forEach((s) => s.close());
      dashboards.forEach((d) => d.destroy());
      charts.forEach((c) => c.destroy());
    },
  };
}
