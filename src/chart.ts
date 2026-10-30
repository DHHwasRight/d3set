import { getChart } from "./charts/registry";
import type { Chart, ChartSpec } from "./charts/types";
import { staticSource } from "./data/static";
import type { DataSource, Row } from "./data/types";
import { applyTheme, lightTheme, type Theme } from "./theme/theme";

export interface ChartOptions {
  spec: ChartSpec;
  /** Fixed rows. Ignored when `source` is given. */
  rows?: Row[];
  /** Live rows, such as `sseSource({ url })`. The chart follows it until `destroy`. */
  source?: DataSource;
  theme?: Theme;
  /** Width in CSS px for a DOM that cannot measure the element (server rendering). */
  width?: number;
  /** Replace server-rendered markup in `el`; the first draw has no transition. */
  hydrate?: boolean;
}

export interface MountedChart {
  chart: Chart;
  source: DataSource;
  setTheme(theme: Theme): void;
  /** Remove the chart. A source passed in options stays open: its owner closes it. */
  destroy(): void;
}

/**
 * One chart in `el`, outside a dashboard: the client-side counterpart of a server-rendered figure.
 *
 *   createChart(el, { spec: { type: "bar", x: "region", y: "amount" }, source: sseSource({ url }) });
 */
export function createChart(el: HTMLElement, opts: ChartOptions): MountedChart {
  let theme = opts.theme ?? lightTheme;
  const body = el.ownerDocument.createElement("div");
  if (opts.width) body.dataset.d3sWidth = String(opts.width);
  el.replaceChildren(body);
  applyTheme(el, theme);
  const chart = getChart(opts.spec.type)(body, opts.spec, { theme: opts.hydrate ? { ...theme, motion: 0 } : theme });
  const owned = !opts.source;
  const source = opts.source ?? staticSource(opts.rows ?? []);
  const unsubscribe = source.subscribe((rows) => chart.update(rows));
  if (opts.hydrate) chart.setTheme(theme);
  return {
    chart,
    source,
    setTheme(next) {
      theme = next;
      applyTheme(el, next);
      chart.setTheme(next);
    },
    destroy() {
      unsubscribe?.();
      if (owned) source.close();
      chart.destroy();
    },
  };
}
