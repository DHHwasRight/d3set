import { mergeRows, type MergeOptions } from "./merge";
import { SourceStore } from "./store";
import type { DataSource, Row } from "./types";

export interface SseSourceOptions extends Partial<MergeOptions> {
  /** Endpoint that streams `text/event-stream`. */
  url: string;
  /** SSE event names to listen to. Default: `["message"]`. */
  events?: string[];
  /** Initial query parameters. `setParams` replaces them and reconnects. */
  params?: Record<string, string | string[]>;
  withCredentials?: boolean;
  /** Convert a raw event payload into rows or an envelope. Default: `JSON.parse`. */
  parse?: (data: string, event: string) => unknown;
  /** Wait this many ms before a burst of messages is sent to listeners. Default: 0 (next animation frame). */
  throttleMs?: number;
  /** For tests and non-browser hosts. */
  EventSource?: typeof EventSource;
  /** Rows to start from, for example rows a server rendered into the page. The stream then updates them. */
  initial?: Row[];
}

export function buildUrl(url: string, params: Record<string, string | string[]> = {}): string {
  const u = new URL(url, typeof location !== "undefined" ? location.href : "http://localhost");
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.delete(k);
    for (const item of Array.isArray(v) ? v : [v]) u.searchParams.append(k, item);
  }
  return u.toString();
}

/**
 * A source that reads server-sent events. The browser `EventSource` reconnects
 * by itself after network errors.
 */
export function sseSource(opts: SseSourceOptions): DataSource {
  const ES = opts.EventSource ?? globalThis.EventSource;
  if (!ES) throw new Error("d3set: sseSource: no EventSource implementation is available.");

  const store = new SourceStore();
  if (opts.initial) store.setRows(opts.initial);
  const merge: MergeOptions = { mode: opts.mode ?? "append", key: opts.key, maxRows: opts.maxRows };
  const parse = opts.parse ?? ((d: string) => JSON.parse(d));
  const events = opts.events ?? ["message"];
  let params = opts.params ?? {};
  let es: EventSource | undefined;
  let pending: Row[] | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    timer = undefined;
    if (pending) store.setRows(pending);
    pending = undefined;
  };

  const schedule = () => {
    if (timer !== undefined) return;
    if (opts.throttleMs) timer = setTimeout(flush, opts.throttleMs);
    else if (typeof requestAnimationFrame !== "undefined") timer = requestAnimationFrame(flush) as never;
    else timer = setTimeout(flush, 0);
  };

  const onMessage = (ev: MessageEvent) => {
    let payload: unknown;
    try {
      payload = parse(ev.data, ev.type);
    } catch (err) {
      console.warn("d3set: sseSource: cannot parse event data, event skipped.", err);
      return;
    }
    pending = mergeRows(pending ?? store.rows(), payload, merge);
    schedule();
  };

  const connect = () => {
    es?.close();
    store.setState("connecting");
    es = new ES(buildUrl(opts.url, params), { withCredentials: opts.withCredentials });
    es.onopen = () => store.setState("open");
    es.onerror = () => store.setState(es?.readyState === 2 ? "closed" : "error");
    for (const name of events) es.addEventListener(name, onMessage as EventListener);
  };

  connect();

  return {
    rows: () => store.rows(),
    subscribe: (l) => store.subscribe(l),
    onState: (l) => store.onState(l),
    setParams(next) {
      params = next;
      pending = undefined;
      store.setRows([]);
      connect();
    },
    close() {
      es?.close();
      store.setState("closed");
    },
  };
}
