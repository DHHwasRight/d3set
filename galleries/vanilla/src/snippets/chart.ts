// How this gallery draws a chart: in the browser, from the spec and rows the page carries.
import { createChart, type ChartPayload, type MountedChart } from "d3set/core";

/**
 * Draw the chart of `payload` in `el`. `hydrate: true` draws the first frame with no transition,
 * as the Rust gallery does when it hydrates; later updates animate.
 */
export function drawChart(el: HTMLElement, payload: ChartPayload): MountedChart {
  const { spec, rows, theme } = payload;
  return createChart(el, {
    spec,
    rows,
    // The payloads carry a full theme. A theme name would need its Theme object.
    theme: typeof theme === "object" ? theme : undefined,
    hydrate: true,
  });
}
