import { sseResponse } from "@d3set/next/server";
import { live } from "../../../lib/sales";

// A stream per request: never cached, never prerendered.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return sseResponse(live(request.signal), { signal: request.signal });
}
