// How this gallery draws a dashboard: `<Dashboard>` from @d3set/react. Its charts share the rows,
// the filters, and the time window.
import { Dashboard } from "@d3set/react";
import type { DashboardPayload } from "d3set/core";
import type { CSSProperties } from "react";

interface Props {
  dashboard: DashboardPayload;
  className?: string;
  style?: CSSProperties;
  onReady: () => void;
}

export function GalleryDashboard({ dashboard, className, style, onReady }: Props) {
  const { charts, filters, filterMode, timeField, timeWindow, rows, theme } = dashboard;
  return (
    <Dashboard
      className={className}
      style={style}
      charts={charts}
      filters={filters}
      filterMode={filterMode}
      timeField={timeField}
      timeWindow={timeWindow}
      rows={rows}
      theme={typeof theme === "object" ? theme : undefined}
      animate={false}
      onReady={onReady}
    />
  );
}
