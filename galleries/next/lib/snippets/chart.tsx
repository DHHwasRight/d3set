// How this gallery draws a chart: a Server Component. The chart is drawn on the server, when the
// page builds; the browser gets its markup and hydrates it.
import { ServerChart } from "@d3set/next/server";
import type { ChartPayload, Theme } from "d3set/core";

interface Props {
  chart: ChartPayload;
  /** The server cannot measure the page: the width to draw at, in CSS px. */
  width: number;
}

// With a `stream` (on GitHub Pages, a JSON timeline polled with `transport: "poll"`), the hydrated
// chart follows it.
export function GalleryChart({ chart: { spec, rows, theme, stream }, width }: Props) {
  return <ServerChart spec={spec} rows={rows} stream={stream} theme={theme as Theme} width={width} />;
}
