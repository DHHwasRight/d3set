import { createChart } from "./chart";
import type { Chart, ChartSpec } from "./charts/types";
import { createDashboard, type Dashboard } from "./dashboard";
import { pollSource } from "./data/poll";
import { sseSource } from "./data/sse";
import { staticSource } from "./data/static";
import type { DataSource, MergeMode, Row } from "./data/types";
import type { FilterDef } from "./filters/filters";
import { darkTheme, lightTheme, type Theme } from "./theme/theme";

/** What a server writes into `<script type="application/json" class="d3s-payload">`. */
interface Payload {
  /** A full theme (the server's tokens), or the name of a built-in theme. */
  theme?: Theme | string;
  rows?: Row[];
  /**
   * Live rows: server-sent events, or with `transport: "poll"` a JSON file fetched again and again
   * (see `pollSource`). With `key`, rows upsert by that field (a replayed catch-up does not count
   * twice).
   */
  stream?: StreamOption;
}

/** Where a hydrated chart's live rows come from. A string is a server-sent events URL. */
export type StreamOption =
  | string
  | {
      url: string;
      maxRows?: number;
      mode?: MergeMode;
      key?: string;
      /** `"sse"` (default): server-sent events. `"poll"`: a JSON file, for a static host. */
      transport?: "sse" | "poll";
      /** For `"poll"`: milliseconds between fetches. A timeline file's own `interval` wins. */
      interval?: number;
    };

/** The source a stream option describes, starting from `rows`. */
export function streamSource(stream: StreamOption, rows: Row[] = []): DataSource {
  const s = typeof stream === "string" ? { url: stream } : stream;
  const merge = { maxRows: s.maxRows, mode: s.mode, key: s.key, initial: rows };
  if ("transport" in s && s.transport === "poll") return pollSource({ url: s.url, interval: s.interval, ...merge });
  return sseSource({ url: s.url, ...merge });
}

export interface DashboardPayload extends Payload {
  charts: ChartSpec[];
  filters?: FilterDef[];
  filterMode?: "client" | "server";
  timeField?: string;
  timeWindow?: string;
  /** When the rows were drawn (ms since the epoch): the time window counts from it. */
  now?: number;
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

/** The chart types of the payloads under `root` that `hydrate` would read. */
export function payloadTypes(root: ParentNode = document): string[] {
  const types = new Set<string>();
  for (const el of root.querySelectorAll("[data-d3s-dashboard]")) {
    for (const spec of readPayload<DashboardPayload>(el)?.charts ?? []) types.add(spec.type);
  }
  for (const el of root.querySelectorAll("[data-d3s-chart]")) {
    const type = readPayload<ChartPayload>(el)?.spec.type;
    if (type) types.add(type);
  }
  if (root instanceof Element) {
    // `root` itself may be a payload element.
    if (root.matches("[data-d3s-dashboard]"))
      readPayload<DashboardPayload>(root)?.charts.forEach((s) => types.add(s.type));
    if (root.matches("[data-d3s-chart]")) {
      const type = readPayload<ChartPayload>(root)?.spec.type;
      if (type) types.add(type);
    }
  }
  return [...types];
}

function themeOf(p: Payload, opts: HydrateOptions): Theme {
  if (p.theme && typeof p.theme === "object") return p.theme;
  const name = p.theme ?? "light";
  return opts.themes?.[name] ?? (name === "dark" ? darkTheme : lightTheme);
}

function sourceOf(p: Payload): DataSource {
  const rows = p.rows ?? [];
  if (!p.stream) return staticSource(rows);
  return streamSource(p.stream, rows);
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
        now: p.now,
        theme: themeOf(p, opts),
        hydrate: true,
      }),
    );
    delete el.dataset.d3sDashboard;
  }

  for (const el of root.querySelectorAll<HTMLElement>("[data-d3s-chart]")) {
    const p = readPayload<ChartPayload>(el);
    if (!p) continue;
    const mounted = createChart(el, { spec: p.spec, source: sourceOf(p), theme: themeOf(p, opts), hydrate: true });
    sources.push(mounted.source);
    charts.push(mounted.chart);
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
