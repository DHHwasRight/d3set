"use client";

import {
  sseSource,
  streamSource,
  type DataSource,
  type Row,
  type SseSourceOptions,
  type StreamOption,
} from "d3set/core";
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

/**
 * Rows from a stream option, as a server writes it into a payload: server-sent events, or with
 * `transport: "poll"` a JSON file (a static host). Mounted in the browser only, like `useSseSource`.
 * `rows` are the rows the page was drawn with: the source starts from them, so the first frame
 * does not change.
 */
export function useStreamSource(stream: StreamOption | undefined, rows: Row[] = []): DataSource | undefined {
  const key = JSON.stringify(stream ?? null);
  const [source, setSource] = useState<DataSource | undefined>(undefined);
  useEffect(() => {
    if (!stream) return;
    const next = streamSource(stream, rows);
    setSource(next);
    return () => {
      next.close();
      setSource(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return source;
}
