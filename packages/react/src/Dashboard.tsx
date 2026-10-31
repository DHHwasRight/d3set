"use client";

import {
  createDashboard,
  staticSource,
  type ChartSpec,
  type Dashboard as Handle,
  type DashboardOptions,
  type DataSource,
  type FilterDef,
  type Row,
  type Theme,
} from "d3set/core";
import { useEffect, useRef, type CSSProperties } from "react";
import { useMounted } from "./useMounted";

export interface DashboardProps extends Pick<
  DashboardOptions,
  "filterMode" | "timeField" | "timeWindow" | "timeWindows" | "now" | "showStatus" | "initialFilters"
> {
  charts: ChartSpec[];
  filters?: FilterDef[];
  /** Fixed rows. A new array updates every chart in place. Ignored when `source` is given. */
  rows?: Row[];
  /** Live rows, such as `useSseSource(url)`. The parent owns it and closes it. */
  source?: DataSource;
  theme?: Theme;
  /** `false`: the first frame is drawn without entry transitions (later updates still animate). */
  animate?: boolean;
  /** Called once the dashboard is drawn. */
  onReady?: () => void;
  className?: string;
  style?: CSSProperties;
}

interface Mounted {
  dashboard: Handle;
  own?: ReturnType<typeof staticSource>;
}

/**
 * A dashboard, drawn in the browser: the React form of `createDashboard`. A change of `charts`,
 * `filters`, or the time options mounts a new one; new `rows` and a new `theme` update it. The
 * element it renders is the dashboard's root (`.d3s-root`): no wrapper.
 */
export function Dashboard({
  charts,
  filters,
  rows,
  source,
  theme,
  animate = true,
  onReady,
  className,
  style,
  ...options
}: DashboardProps) {
  const latestRows = useRef(rows);
  latestRows.current = rows;
  const { ref, handle } = useMounted<Mounted>(
    `${JSON.stringify([charts, filters, options])}|${source ? "source" : "rows"}|${animate}`,
    charts.map((c) => c.type),
    (el) => {
      const own = source ? undefined : staticSource(latestRows.current ?? []);
      const dashboard = createDashboard(el, {
        ...options,
        charts,
        filters,
        theme,
        source: source ?? own!,
        hydrate: !animate,
      });
      return { dashboard, own };
    },
    (m) => {
      m.dashboard.destroy();
      m.own?.close();
    },
    onReady,
  );

  useEffect(() => {
    if (rows) handle.current?.own?.set(rows);
  }, [rows, handle]);
  useEffect(() => {
    if (theme) handle.current?.dashboard.setTheme(theme);
  }, [theme, handle]);

  return <div ref={ref as React.RefObject<HTMLDivElement | null>} className={className} style={style} />;
}

export type { DataSource };
