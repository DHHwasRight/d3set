// How this gallery draws a dashboard: its charts share one source of rows, the filters and the
// time window apply to all of them.
import { createDashboard, staticSource, type DashboardPayload } from "d3set/core";

/** Draw the dashboard of `payload` in `el`. Returns what removes it. */
export function drawDashboard(el: HTMLElement, payload: DashboardPayload): () => void {
  const { charts, filters, filterMode, timeField, timeWindow, rows, theme } = payload;
  // The rows of the page: they do not change.
  const source = staticSource(rows ?? []);
  const dashboard = createDashboard(el, {
    source,
    charts,
    filters,
    filterMode,
    timeField,
    timeWindow,
    theme: typeof theme === "object" ? theme : undefined,
    hydrate: true,
  });
  return () => {
    dashboard.destroy();
    source.close();
  };
}
