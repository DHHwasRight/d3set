/**
 * An `EventSource` built on `fetch`, for streams that need request headers (an `Authorization`
 * header, an organization header): the browser's `EventSource` cannot send any. It has the part of
 * the `EventSource` interface `sseSource` uses: `readyState`, `onopen`, `onerror`,
 * `addEventListener` and `close`, and it reconnects after an error or the end of the response,
 * like the browser's, after `retry` ms (from the stream's `retry:` field, 3000 by default).
 *
 * The stream format is the server-sent events one: `event:`, `data:`, `id:` and `retry:` lines,
 * a blank line ends a message, `:` starts a comment. The last `id:` goes back in `Last-Event-ID`.
 */

export interface FetchEventSourceInit {
  headers?: Record<string, string>;
  withCredentials?: boolean;
  /** For tests and non-browser hosts. Default: the global `fetch`. */
  fetch?: typeof fetch;
}

type Listener = (ev: MessageEvent) => void;

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

export class FetchEventSource {
  static readonly CONNECTING = CONNECTING;
  static readonly OPEN = OPEN;
  static readonly CLOSED = CLOSED;

  readyState = CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  readonly url: string;

  private listeners = new Map<string, Set<Listener>>();
  private controller?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  private retry = 3000;
  private lastId = "";

  constructor(
    url: string,
    private init: FetchEventSourceInit = {},
  ) {
    this.url = url;
    void this.connect();
  }

  addEventListener(type: string, listener: Listener): void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.readyState = CLOSED;
    clearTimeout(this.timer);
    this.controller?.abort();
  }

  private async connect(): Promise<void> {
    const doFetch = this.init.fetch ?? globalThis.fetch;
    this.controller = new AbortController();
    const headers: Record<string, string> = { Accept: "text/event-stream", ...this.init.headers };
    if (this.lastId) headers["Last-Event-ID"] = this.lastId;
    try {
      const res = await doFetch(this.url, {
        headers,
        credentials: this.init.withCredentials ? "include" : "same-origin",
        signal: this.controller.signal,
        cache: "no-store",
      });
      if (!res.ok || !res.body) {
        // Like the browser: a wrong status or type fails the connection for good.
        this.fail(true);
        return;
      }
      this.readyState = OPEN;
      this.onopen?.(new Event("open"));
      await this.read(res.body);
      // The server ended the response: reconnect, as the browser does.
      this.fail(false);
    } catch {
      if (this.readyState !== CLOSED) this.fail(false);
    }
  }

  private fail(fatal: boolean): void {
    if (this.readyState === CLOSED) return;
    this.readyState = fatal ? CLOSED : CONNECTING;
    this.onerror?.(new Event("error"));
    if (!fatal && this.readyState === CONNECTING) {
      this.timer = setTimeout(() => void this.connect(), this.retry);
    }
  }

  private async read(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let event = "";
    let data: string[] = [];
    const dispatch = () => {
      if (data.length) {
        const type = event || "message";
        const ev = new MessageEvent(type, { data: data.join("\n"), lastEventId: this.lastId });
        this.listeners.get(type)?.forEach((l) => l(ev));
      }
      event = "";
      data = [];
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.search(/\r\n|\r|\n/)) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + (buffer.startsWith("\r\n", nl) ? 2 : 1));
        if (line === "") {
          dispatch();
          continue;
        }
        if (line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
        else if (field === "id") this.lastId = value;
        else if (field === "retry" && /^\d+$/.test(value)) this.retry = Number(value);
      }
    }
  }
}
