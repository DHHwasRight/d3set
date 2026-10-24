import { getChart } from "./charts/registry";
import type { Chart, ChartSpec } from "./charts/types";
import type { DataSource, Row } from "./data/types";
import { renderFilterBar } from "./filters/bar";
import { applyFilters, FilterStore, filtersToParams, type FilterDef, type FilterState } from "./filters/filters";
import { applyTheme, lightTheme, type Theme } from "./theme/theme";

export interface DashboardOptions {
  source: DataSource;
  charts: ChartSpec[];
  filters?: FilterDef[];
  initialFilters?: FilterState;
  /**
   * - `client` (default): filter the received rows in the browser.
   * - `server`: send the filters as query parameters to the source, which reconnects.
   */
  filterMode?: "client" | "server";
  theme?: Theme;
  /** Show the connection state. Default: true. */
  showStatus?: boolean;
}

export interface Dashboard {
  filters: FilterStore;
  setTheme(theme: Theme): void;
  destroy(): void;
}

/** Mount filters and charts in `el`, and connect them to one data source. */
export function createDashboard(el: HTMLElement, opts: DashboardOptions): Dashboard {
  let theme = opts.theme ?? lightTheme;
  const defs = opts.filters ?? [];
  const mode = opts.filterMode ?? "client";
  const store = new FilterStore(opts.initialFilters);
  const cleanups: Array<() => void> = [];

  el.classList.add("d3s-root");
  applyTheme(el, theme);

  // Filter bar and status line.
  const header = document.createElement("div");
  header.style.cssText = "display:flex;justify-content:space-between;align-items:end;gap:8px;flex-wrap:wrap";
  const filterEl = document.createElement("div");
  header.append(filterEl);
  if (opts.showStatus !== false) {
    const status = document.createElement("span");
    status.className = "d3s-status";
    header.append(status);
    cleanups.push(
      opts.source.onState((s) => {
        status.dataset.state = s;
        status.textContent = s === "open" ? "Live" : s;
      }),
    );
  }
  el.append(header);
  const bar = defs.length ? renderFilterBar(filterEl, defs, store, () => opts.source.rows()) : undefined;

  // Chart cards.
  const grid = document.createElement("div");
  grid.className = "d3s-grid";
  el.append(grid);
  const charts: Chart[] = opts.charts.map((spec) => {
    const card = document.createElement("section");
    card.className = "d3s-card";
    if (spec.title) {
      const h = document.createElement("h3");
      h.textContent = spec.title;
      card.append(h);
    }
    const body = document.createElement("div");
    card.append(body);
    grid.append(card);
    return getChart(spec.type)(body, spec, { theme });
  });

  const render = (rows: Row[]) => {
    const visible = mode === "client" ? applyFilters(rows, defs, store.get()) : rows;
    for (const c of charts) c.update(visible);
  };

  cleanups.push(
    opts.source.subscribe((rows) => {
      bar?.refresh();
      render(rows);
    }),
  );

  if (mode === "server") opts.source.setParams(filtersToParams(defs, store.get()));
  cleanups.push(
    store.subscribe((state) => {
      if (mode === "server") opts.source.setParams(filtersToParams(defs, state));
      else render(opts.source.rows());
    }),
  );

  return {
    filters: store,
    setTheme(next) {
      theme = next;
      applyTheme(el, theme);
      for (const c of charts) c.setTheme(theme);
    },
    destroy() {
      cleanups.forEach((f) => f());
      charts.forEach((c) => c.destroy());
      bar?.destroy();
      el.replaceChildren();
      el.classList.remove("d3s-root");
    },
  };
}
