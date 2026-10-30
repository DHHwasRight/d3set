// How this gallery draws a chart: in the browser, from the spec and rows the page carries.
import { createChart, streamSource, type ChartPayload, type MountedChart } from "d3set/core";

/**
 * Draw the chart of `payload` in `el`. `hydrate: true` draws the first frame with no transition,
 * as the Rust gallery does when it hydrates; later updates animate. With a `stream` (on GitHub
 * Pages, a JSON timeline polled with `transport: "poll"`), new rows update the chart.
 */
export function drawChart(el: HTMLElement, payload: ChartPayload): MountedChart {
  const { spec, rows, theme, stream } = payload;
  const source = stream ? streamSource(stream, rows) : undefined;
  const chart = createChart(el, {
    spec,
    rows,
    source,
    // The payloads carry a full theme. A theme name would need its Theme object.
    theme: typeof theme === "object" ? theme : undefined,
    hydrate: true,
  });
  return {
    ...chart,
    destroy() {
      chart.destroy();
      source?.close();
    },
  };
}
