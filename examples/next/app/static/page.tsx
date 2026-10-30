import { ServerDashboard } from "@d3set/next/server";
import { charts, history } from "../../lib/sales";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <h1>Server, static</h1>
      <ServerDashboard charts={charts} rows={history()} width={928} hydrate={false} />
    </>
  );
}
