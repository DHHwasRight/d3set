// How this gallery draws a dashboard: its charts share one source of rows, the filters and the
// time window apply to all of them.
import { createDashboard, staticSource, streamSource, type DashboardPayload } from "d3set/core";

/** Draw the dashboard of `payload` in `el`. Returns what removes it. */
export function drawDashboard(el: HTMLElement, payload: DashboardPayload): () => void {
  const { charts, filters, filterMode, timeField, timeWindow, now, rows, theme, stream } = payload;
  // The rows of the page, then the new rows of the stream if it has one (on GitHub Pages, a JSON
  // timeline polled with `transport: "poll"`).
  const source = stream ? streamSource(stream, rows ?? []) : staticSource(rows ?? []);
  const dashboard = createDashboard(el, {
    source,
    charts,
    filters,
    filterMode,
    timeField,
    timeWindow,
    now,
    theme: typeof theme === "object" ? theme : undefined,
    hydrate: true,
  });
  return () => {
    dashboard.destroy();
    source.close();
  };
}
