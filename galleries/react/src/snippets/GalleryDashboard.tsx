// How this gallery draws a dashboard: `<Dashboard>` from @d3set/react. Its charts share the rows,
// the filters, and the time window.
import { Dashboard, useStreamSource } from "@d3set/react";
import type { DashboardPayload } from "d3set/core";
import type { CSSProperties } from "react";

interface Props {
  dashboard: DashboardPayload;
  className?: string;
  style?: CSSProperties;
  onReady: () => void;
}

export function GalleryDashboard({ dashboard, className, style, onReady }: Props) {
  const { charts, filters, filterMode, timeField, timeWindow, now, rows, theme, stream } = dashboard;
  // On GitHub Pages, new rows from a JSON timeline polled with `transport: "poll"`.
  const source = useStreamSource(stream, rows);
  return (
    <Dashboard
      className={className}
      style={style}
      charts={charts}
      filters={filters}
      filterMode={filterMode}
      timeField={timeField}
      timeWindow={timeWindow}
      now={now}
      rows={rows}
      source={source}
      theme={typeof theme === "object" ? theme : undefined}
      animate={false}
      onReady={onReady}
    />
  );
}
