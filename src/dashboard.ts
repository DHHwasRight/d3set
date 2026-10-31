import * as d3 from "d3";
import type { Interactions, RangeValue } from "./charts/interactions";
import { getChart } from "./charts/registry";
import type { Chart, ChartSpec } from "./charts/types";
import { asDate, parseInterval } from "./charts/util";
import type { DataSource, Row } from "./data/types";
import { renderFilterBar } from "./filters/bar";
import {
  applyFilters,
  dateRange,
  FilterStore,
  filtersToParams,
  multiSelect,
  range,
  type FilterDef,
  type FilterState,
  type FilterValue,
} from "./filters/filters";
import { applyTheme, lightTheme, type Theme } from "./theme/theme";

export interface DashboardOptions {
  source: DataSource;
  charts: ChartSpec[];
  filters?: FilterDef[];
  initialFilters?: FilterState;
  /**
   * - `client` (default): filter the received rows in the browser.
   * - `server`: send the filters as query parameters to the source, which reconnects.
   *   Cross-filters then apply to every chart, the selecting chart too.
   */
  filterMode?: "client" | "server";
  theme?: Theme;
  /** Show the connection state. Default: true. */
  showStatus?: boolean;
  /** Time field of the rows. Enables the time window picker and the Pause button. */
  timeField?: string;
  /** Window choices for the picker, as intervals or `all`. Default: `5m 15m 1h 6h 1d all`. */
  timeWindows?: string[];
  /** Initial time window. Default: `all`. */
  timeWindow?: string;
  /**
   * When the rows were drawn, in ms since the epoch. The time window counts from it and moves on
   * with the clock, so recorded rows (a static site) stay in the window. Default: the clock.
   */
  now?: number;
  /**
   * Replace server-rendered markup in `root` (see `hydrate`). The first draw has no transition,
   * so the swap from server markup to live charts does not animate.
   */
  hydrate?: boolean;
  /**
   * Width of the dashboard in CSS px, for a DOM that cannot measure it (server rendering). Each
   * chart is drawn at the width its card gets in the grid at this width.
   */
  width?: number;
}

/**
 * Width of a chart in a card spanning `span` columns of a `.d3s-grid` that is `width` wide:
 * `repeat(auto-fill, minmax(min(100%, 320px), 1fr))` with `gap`, the card padding being `gap`
 * too (the theme's `space.md`). The server renderer (Rust `chart_width`) sizes cards the same way.
 */
export function cardChartWidth(width: number, span: number, gap: number): number {
  const columns = Math.max(1, Math.floor((width + gap) / (320 + gap)));
  const card = (width - gap * (columns - 1)) / columns;
  const s = Math.min(Math.max(1, span), columns);
  return card * s + gap * (s - 1) - 2 * gap;
}

export interface Dashboard {
  filters: FilterStore;
  setTheme(theme: Theme): void;
  /** Show only rows newer than this interval (for example `15m`), or `all`. Clears a brush range on the time field. */
  setTimeWindow(window: string): void;
  /** Stop or restart applying new data. Filters still work on the frozen data. */
  setPaused(paused: boolean): void;
  /** Clear all filters, cross-filters, and ranges. */
  clearFilters(): void;
  destroy(): void;
}

/** Status labels, the same words the server renders, so hydration does not change the text. */
const STATUS_LABELS: Record<string, string> = {
  idle: "Connecting",
  connecting: "Connecting",
  open: "Live",
  error: "Reconnecting",
  closed: "Closed",
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

const isEmpty = (v: FilterValue) =>
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.values(v).every((x) => x === undefined || x === ""));

/** Human text for a filter value, for the chips. */
function describe(v: FilterValue): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "string") return v;
  if (v && "from" in v) {
    const f = (s?: string) => (s ? (s.length > 10 ? d3.utcFormat("%H:%M:%S")(new Date(s)) : s) : "…");
    return `${f(v.from)} – ${f(v.to)}`;
  }
  if (v && ("min" in v || "max" in v)) {
    const r = v as { min?: number; max?: number };
    const f = d3.format(".4~g");
    return `${r.min === undefined ? "…" : f(r.min)} – ${r.max === undefined ? "…" : f(r.max)}`;
  }
  return "";
}

/**
 * Mount filters and charts in `el`, and connect them to one data source.
 *
 * Interactions between charts:
 * - click a mark (bar, slice, row, tile) to cross-filter the other charts; shift-click adds values;
 * - drag on a time or number axis to zoom every chart to that range; double-click to reset;
 * - hover a time chart to show the same time on the other time charts.
 */
export function createDashboard(root: HTMLElement, opts: DashboardOptions): Dashboard {
  let theme = opts.theme ?? lightTheme;
  const declared = opts.filters ?? [];
  const implicit = new Map<string, FilterDef>();
  const allDefs = () => [...declared, ...implicit.values()];
  const mode = opts.filterMode ?? "client";
  const store = new FilterStore(opts.initialFilters);
  const cleanups: Array<() => void> = [];
  const timeField = opts.timeField;
  let windowMs: number | undefined;
  // The time of the data: the clock, moved to `now` when the rows were drawn at another time.
  const offset = opts.now === undefined ? 0 : opts.now - Date.now();
  const clock = () => Date.now() + offset;
  let paused = false;
  let frozen: Row[] | undefined;
  let pausedAt = 0;

  if (opts.hydrate) root.replaceChildren();
  root.classList.add("d3s-root");
  applyTheme(root, theme);

  // Header: filter bar on the left, time controls and status on the right.
  const header = el("div", "d3s-header");
  const filterEl = el("div");
  const controls = el("div", "d3s-controls");
  header.append(filterEl, controls);
  const chips = el("div", "d3s-chips");
  root.append(header, chips);
  const bar = declared.length ? renderFilterBar(filterEl, declared, store, () => opts.source.rows()) : undefined;

  let windowButtons: HTMLButtonElement[] = [];
  let pauseButton: HTMLButtonElement | undefined;
  if (timeField) {
    const picker = el("div", "d3s-segmented");
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", "Time window");
    windowButtons = (opts.timeWindows ?? ["5m", "15m", "1h", "6h", "1d", "all"]).map((w) => {
      const b = el("button", "", w === "all" ? "All" : w);
      b.type = "button";
      b.dataset.window = w;
      b.addEventListener("click", () => api.setTimeWindow(w));
      return b;
    });
    picker.append(...windowButtons);
    pauseButton = el("button", "d3s-pause", "Pause");
    pauseButton.type = "button";
    pauseButton.addEventListener("click", () => api.setPaused(!paused));
    controls.append(picker, pauseButton);
  }
  // The initial window applies before the first draw: the first frame is already windowed.
  if (timeField) {
    const w = opts.timeWindow ?? "all";
    windowMs = w === "all" ? undefined : parseInterval(w);
    for (const b of windowButtons) b.setAttribute("aria-pressed", String(b.dataset.window === w));
  }
  let statusEl: HTMLSpanElement | undefined;
  let sourceState = "idle";
  const showStatus = () => {
    if (!statusEl) return;
    statusEl.dataset.state = paused ? "paused" : sourceState;
    statusEl.textContent = paused ? "Paused" : (STATUS_LABELS[sourceState] ?? sourceState);
  };
  if (opts.showStatus !== false) {
    statusEl = el("span", "d3s-status");
    controls.append(statusEl);
    cleanups.push(
      opts.source.onState((s) => {
        sourceState = s;
        showStatus();
      }),
    );
  }

  // Shared hover between time charts.
  const hoverListeners = new Map<string, (t: number | undefined) => void>();

  // Filters set by charts.
  const selectDef = (field: string): FilterDef => {
    const d = declared.find((x) => x.field === field && x.type === "select");
    if (d) return d;
    const id = `select:${field}`;
    if (!implicit.has(id)) implicit.set(id, multiSelect(field, { id }));
    return implicit.get(id)!;
  };
  const rangeDef = (field: string, time: boolean): FilterDef => {
    const d = declared.find((x) => x.field === field && x.type === (time ? "dateRange" : "range"));
    if (d) return d;
    const id = `${time ? "time" : "range"}:${field}`;
    if (!implicit.has(id)) implicit.set(id, time ? dateRange(field, { id }) : range(field, { id }));
    return implicit.get(id)!;
  };

  const interactionsFor = (chartId: string): Interactions => ({
    toggle(field, value, additive) {
      const def = selectDef(field);
      const cur = store.get()[def.id];
      if (def.type === "select" && !def.multiple) {
        store.set(def.id, cur === value ? undefined : value, chartId);
        return;
      }
      let next = new Set(Array.isArray(cur) ? cur : typeof cur === "string" ? [cur] : []);
      if (additive) {
        if (next.has(value)) next.delete(value);
        else next.add(value);
      } else {
        next = next.size === 1 && next.has(value) ? new Set() : new Set([value]);
      }
      store.set(def.id, next.size ? [...next] : undefined, chartId);
    },
    selection(field) {
      const defs = allDefs().filter(
        (d) => d.field === field && d.type === "select" && store.sourceOf(d.id) === chartId,
      );
      if (!defs.length) return undefined;
      const values = defs.flatMap((d) => {
        const v = store.get()[d.id];
        return Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
      });
      return values.length ? new Set(values) : undefined;
    },
    setRange(field, r: RangeValue | undefined) {
      if (r === undefined) {
        for (const d of allDefs())
          if (d.field === field && (d.type === "range" || d.type === "dateRange")) store.set(d.id, undefined);
        return;
      }
      store.set(rangeDef(field, "from" in r || "to" in r).id, r);
    },
    hoverTime(t) {
      for (const [id, fn] of hoverListeners) if (id !== chartId) fn(t);
    },
    onHoverTime(fn) {
      hoverListeners.set(chartId, fn);
      return () => hoverListeners.delete(chartId);
    },
  });

  // Chart cards.
  const grid = el("div", "d3s-grid");
  root.append(grid);
  const chartIds = opts.charts.map((_, i) => `chart-${i}`);
  const charts: Chart[] = opts.charts.map((spec, i) => {
    const card = el("section", "d3s-card");
    if (spec.span && spec.span > 1) card.dataset.span = String(spec.span);
    if (spec.title) card.append(el("h3", "", spec.title));
    const body = el("div");
    if (opts.width) body.dataset.d3sWidth = String(cardChartWidth(opts.width, spec.span ?? 1, theme.space.md));
    card.append(body);
    grid.append(card);
    const first = opts.hydrate ? { ...theme, motion: 0 } : theme;
    return getChart(spec.type)(body, spec, { theme: first, interactions: interactionsFor(chartIds[i]!) });
  });

  function renderChips() {
    const state = store.get();
    const active = allDefs().filter((d) => !isEmpty(state[d.id]));
    chips.hidden = active.length === 0;
    chips.replaceChildren(
      ...active.map((d) => {
        const chip = el("span", "d3s-chip");
        if (store.sourceOf(d.id)) chip.dataset.source = "chart";
        const x = el("button", "", "×");
        x.type = "button";
        x.setAttribute("aria-label", `Remove filter ${d.label}`);
        x.addEventListener("click", () => store.set(d.id, undefined));
        chip.append(el("b", "", `${d.label}: `), describe(state[d.id]), x);
        return chip;
      }),
      ...(active.length > 1
        ? [
            (() => {
              const b = el("button", "d3s-filter-reset", "Clear all");
              b.type = "button";
              b.addEventListener("click", () => api.clearFilters());
              return b;
            })(),
          ]
        : []),
    );
  }

  function inWindow(rows: Row[]): Row[] {
    if (!timeField || windowMs === undefined) return rows;
    const start = (paused ? pausedAt : clock()) - windowMs;
    return rows.filter((r) => (asDate(r[timeField])?.getTime() ?? -Infinity) >= start);
  }

  function render() {
    const rows = inWindow(frozen ?? opts.source.rows());
    const state = store.get();
    const defs = allDefs();
    if (mode === "server") {
      for (const c of charts) c.update(rows);
      return;
    }
    // Filters from the bar, code, and brush ranges apply to every chart.
    const shared = defs.filter((d) => !store.sourceOf(d.id));
    const base = applyFilters(rows, shared, state);
    // Cross-filters apply to every chart except the one that set them.
    const crossDefs = defs.filter((d) => store.sourceOf(d.id));
    charts.forEach((c, i) => {
      const others = crossDefs.filter((d) => store.sourceOf(d.id) !== chartIds[i]);
      c.update(others.length ? applyFilters(base, others, state) : base);
    });
  }

  cleanups.push(
    opts.source.subscribe(() => {
      if (paused) return;
      bar?.refresh();
      render();
    }),
  );
  // Hydration drew without motion; later updates animate.
  if (opts.hydrate) for (const c of charts) c.setTheme(theme);

  const pushParams = () => {
    if (mode === "server") opts.source.setParams(filtersToParams(allDefs(), store.get()));
  };
  pushParams();
  cleanups.push(
    store.subscribe(() => {
      renderChips();
      if (mode === "server") pushParams();
      else render();
    }),
  );

  // Slide the time window even when no data arrives.
  const tick = setInterval(() => {
    if (windowMs !== undefined && !paused) render();
  }, 5000);
  cleanups.push(() => clearInterval(tick));

  const api: Dashboard = {
    filters: store,
    setTheme(next) {
      theme = next;
      applyTheme(root, theme);
      for (const c of charts) c.setTheme(theme);
    },
    setTimeWindow(w) {
      windowMs = w === "all" ? undefined : parseInterval(w);
      for (const b of windowButtons) b.setAttribute("aria-pressed", String(b.dataset.window === w));
      if (timeField)
        api.filters.reset(
          (id) => !allDefs().some((d) => d.id === id && d.field === timeField && d.type === "dateRange"),
        );
      else render();
    },
    setPaused(next) {
      paused = next;
      frozen = paused ? opts.source.rows() : undefined;
      pausedAt = clock();
      if (pauseButton) {
        pauseButton.textContent = paused ? "Resume" : "Pause";
        pauseButton.setAttribute("aria-pressed", String(paused));
      }
      showStatus();
      render();
    },
    clearFilters() {
      store.reset();
    },
    destroy() {
      cleanups.forEach((f) => f());
      charts.forEach((c) => c.destroy());
      bar?.destroy();
      root.replaceChildren();
      root.classList.remove("d3s-root");
    },
  };

  renderChips();
  return api;
}
