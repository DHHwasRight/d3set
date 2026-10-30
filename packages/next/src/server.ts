// d3set for Next.js, server side (App Router).
//
// - `<ServerChart>` / `<ServerDashboard>`: Server Components. The charts are drawn on the server,
//   in the HTML of the first response, then hydrated (or static with `hydrate={false}`).
// - `sseResponse`: a route handler's live data, the server-sent events `stream` points to.
//
//   // app/api/sales/route.ts
//   export const dynamic = "force-dynamic";
//   export function GET(request: Request) {
//     return sseResponse(liveSales(), { signal: request.signal });
//   }
import "server-only";

export {
  ServerChart,
  ServerDashboard,
  type ServerChartProps,
  type ServerDashboardProps,
  type RenderChartOptions,
  type RenderDashboardOptions,
} from "@d3set/react/server";
export { renderChart, renderDashboard, sseResponse, type SseMessage, type SseResponseOptions } from "d3set/server";
