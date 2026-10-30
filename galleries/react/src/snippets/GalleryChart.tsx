// How this gallery draws a chart: `<Chart>` from @d3set/react, in the browser.
import { Chart } from "@d3set/react";
import type { ChartPayload } from "d3set/core";
import type { HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLElement> {
  chart: ChartPayload;
  /** Called once the chart has drawn. */
  onReady: () => void;
}

/**
 * The chart of `chart` in a `<figure>`. `animate={false}`: the first frame is the final one, as
 * when the Rust gallery hydrates; later updates animate.
 */
export function GalleryChart({ chart: { spec, rows, theme }, onReady, ...figure }: Props) {
  return (
    <Chart
      as="figure"
      {...figure}
      spec={spec}
      rows={rows}
      // The payloads carry a full theme. A theme name would need its Theme object.
      theme={typeof theme === "object" ? theme : undefined}
      animate={false}
      onReady={onReady}
    />
  );
}
