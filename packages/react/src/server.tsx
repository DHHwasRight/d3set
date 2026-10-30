// React Server Components: charts rendered on the server, like the Rust renderer does for rsx,
// then hydrated in the browser, or left static. Import from "@d3set/react/server" in server code
// only: rendering runs the charts against a server-side DOM (d3set/server).

import { renderChart, renderDashboard, type RenderChartOptions, type RenderDashboardOptions } from "d3set/server";
import { Hydrate } from "./Hydrate";

export interface ServerProps {
  /** `true` (default): live in the browser after hydration. `false`: static markup, no client code. */
  hydrate?: boolean;
  className?: string;
}

export type ServerChartProps = Omit<RenderChartOptions, "payload"> & ServerProps;
export type ServerDashboardProps = Omit<RenderDashboardOptions, "payload"> & ServerProps;

/** One chart, drawn on the server. With `stream`, it follows server-sent events once hydrated. */
export function ServerChart({ hydrate = true, className, ...options }: ServerChartProps) {
  return frame(renderChart({ ...options, payload: hydrate }), hydrate, className);
}

/** A dashboard, drawn on the server, with its filters. Hydration makes it interactive and live. */
export function ServerDashboard({ hydrate = true, className, ...options }: ServerDashboardProps) {
  return frame(renderDashboard({ ...options, payload: hydrate }), hydrate, className);
}

function frame(html: string, hydrate: boolean, className?: string) {
  return hydrate ? (
    <Hydrate html={html} className={className} />
  ) : (
    <div className={className} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export { Hydrate };
export type { RenderChartOptions, RenderDashboardOptions };
