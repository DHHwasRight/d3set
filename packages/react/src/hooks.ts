"use client";

import { sseSource, type DataSource, type SseSourceOptions } from "d3set/core";
import { useEffect, useState } from "react";

/**
 * Rows from server-sent events at `url`, for `<Chart source>` and `<Dashboard source>`. One
 * connection per `url` and options, closed when the component unmounts or they change.
 *
 * `undefined` until the component is mounted: the connection opens in the browser only, so the
 * first render is the same on the server and in the browser (no hydration mismatch).
 */
export function useSseSource(url: string, options: Omit<SseSourceOptions, "url"> = {}): DataSource | undefined {
  const key = JSON.stringify(options);
  const [source, setSource] = useState<DataSource | undefined>(undefined);
  useEffect(() => {
    const next = sseSource({ ...options, url });
    setSource(next);
    return () => {
      next.close();
      setSource(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key]);
  return source;
}
