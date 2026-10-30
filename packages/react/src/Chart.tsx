"use client";

import {
  createChart,
  staticSource,
  type ChartSpec,
  type DataSource,
  type MountedChart,
  type Row,
  type Theme,
} from "d3set/core";
import { createElement, useEffect, useRef, type CSSProperties, type HTMLAttributes } from "react";
import { useMounted } from "./useMounted";

export interface ChartProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  spec: ChartSpec;
  /** Fixed rows. A new array redraws the chart in place. Ignored when `source` is given. */
  rows?: Row[];
  /** Live rows, such as `useSseSource(url)`. The parent owns it and closes it. */
  source?: DataSource;
  theme?: Theme;
  /** `false`: the first frame is drawn without entry transitions (later updates still animate). */
  animate?: boolean;
  /** Called once the chart is drawn (with `animate`, its entry transitions then run for `theme.motion` ms). */
  onReady?: () => void;
  /** The element the chart is drawn in. Default `div`; `figure` for a figure without a wrapper. */
  as?: "div" | "figure" | "section";
  className?: string;
  style?: CSSProperties;
}

interface Handle {
  mounted: MountedChart;
  /** The rows source the component made from `rows`, closed with it. */
  own?: ReturnType<typeof staticSource>;
}

/**
 * One chart, drawn in the browser: the React form of `createChart`. A change of `spec` mounts a
 * new chart; new `rows` and a new `theme` update the one there.
 */
export function Chart({ spec, rows, source, theme, animate = true, onReady, as = "div", ...attrs }: ChartProps) {
  const latestRows = useRef(rows);
  latestRows.current = rows;
  const { ref, handle } = useMounted<Handle>(
    `${JSON.stringify(spec)}|${source ? "source" : "rows"}|${animate}`,
    [spec.type],
    (el) => {
      const own = source ? undefined : staticSource(latestRows.current ?? []);
      return { own, mounted: createChart(el, { spec, source: source ?? own, theme, hydrate: !animate }) };
    },
    (h) => {
      h.mounted.destroy();
      h.own?.close();
    },
    onReady,
  );

  useEffect(() => {
    if (rows) handle.current?.own?.set(rows);
  }, [rows, handle]);
  useEffect(() => {
    if (theme) handle.current?.mounted.setTheme(theme);
  }, [theme, handle]);

  return createElement(as, { ...attrs, ref });
}
