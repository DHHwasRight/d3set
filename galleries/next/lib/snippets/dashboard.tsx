// How this gallery draws a dashboard: a Server Component, like a chart. After hydration, the
// filters, cross-filtering, brush zoom, and time window work in the browser.
import { ServerDashboard } from "@d3set/next/server";
import type { DashboardPayload, Theme } from "d3set/core";

interface Props {
  dashboard: DashboardPayload;
  /** The width of the dashboard: the cards are sized as the CSS grid sizes them. */
  width: number;
}

export function GalleryDashboard({ dashboard, width }: Props) {
  const { charts, filters, filterMode, timeField, timeWindow, now, rows, theme, stream } = dashboard;
  return (
    <ServerDashboard
      charts={charts}
      filters={filters}
      filterMode={filterMode}
      timeField={timeField}
      timeWindow={timeWindow}
      now={now}
      rows={rows}
      // On GitHub Pages, a JSON timeline polled with `transport: "poll"`. In dev, none: fixed rows.
      stream={stream}
      theme={theme as Theme}
      width={width}
    />
  );
}
