import { ServerChart } from "@d3set/next/server";
import { history } from "../../lib/sales";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <h1>One chart</h1>
      <ServerChart
        spec={{ type: "bar", x: "region", y: "amount", series: "product", stacked: true, height: 280 }}
        rows={history()}
        width={928}
        stream="/api/sales"
      />
    </>
  );
}
