import { ServerDashboard } from "@d3set/next/server";
import { charts, filters, history } from "../../lib/sales";

// Rendered per request: the history ends now, and the stream continues from there.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <h1>Server, hydrated</h1>
      <ServerDashboard charts={charts} filters={filters} rows={history()} width={928} stream="/api/sales" />
    </>
  );
}
