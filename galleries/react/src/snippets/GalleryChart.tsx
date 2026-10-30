// How this gallery draws a chart: `<Chart>` from @d3set/react, in the browser.
import { Chart, useStreamSource } from "@d3set/react";
import type { ChartPayload } from "d3set/core";
import type { HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLElement> {
  chart: ChartPayload;
  /** Called once the chart has drawn. */
  onReady: () => void;
}

/**
 * The chart of `chart` in a `<figure>`. `animate={false}`: the first frame is the final one, as
 * when the Rust gallery hydrates; later updates animate. With a `stream` (on GitHub Pages, a JSON
 * timeline polled with `transport: "poll"`), new rows update the chart.
 */
export function GalleryChart({ chart: { spec, rows, theme, stream }, onReady, ...figure }: Props) {
  const source = useStreamSource(stream, rows);
  return (
    <Chart
      as="figure"
      {...figure}
      spec={spec}
      rows={rows}
      source={source}
      // The payloads carry a full theme. A theme name would need its Theme object.
      theme={typeof theme === "object" ? theme : undefined}
      animate={false}
      onReady={onReady}
    />
  );
}
