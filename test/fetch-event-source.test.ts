// sseSource with `headers`: the stream is read with fetch, which can send them.
import { describe, expect, it, vi } from "vitest";
import { FetchEventSource } from "../src/data/fetch-event-source";
import { sseSource } from "../src/data/sse";

/** A fetch that answers one SSE response per call, from `bodies`, then hangs. */
function fakeFetch(bodies: string[][]) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string> });
    const chunks = bodies.shift();
    if (!chunks) return new Promise<Response>(() => {});
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk));
        c.close();
      },
    });
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("FetchEventSource", () => {
  it("sends the headers and parses events split across chunks", async () => {
    const { fn, calls } = fakeFetch([[": hi\nevent: rows\nda", 'ta: {"a":1}\n\ndata: plain\r\n\r\n']]);
    const seen: string[] = [];
    const es = new FetchEventSource("/s", { headers: { Authorization: "Bearer t" }, fetch: fn });
    es.addEventListener("rows", (e) => seen.push(`rows ${e.data}`));
    es.addEventListener("message", (e) => seen.push(`message ${e.data}`));
    await vi.waitFor(() => expect(seen).toEqual(['rows {"a":1}', "message plain"]));
    expect(calls[0]!.headers).toMatchObject({ Authorization: "Bearer t", Accept: "text/event-stream" });
    es.close();
  });

  it("reconnects after the response ends, with the last event id and the server's retry", async () => {
    vi.useFakeTimers();
    const { fn, calls } = fakeFetch([["retry: 50\nid: 7\ndata: 1\n\n"], ["data: 2\n\n"]]);
    const seen: string[] = [];
    const es = new FetchEventSource("/s", { fetch: fn });
    es.addEventListener("message", (e) => seen.push(e.data));
    await vi.advanceTimersByTimeAsync(10);
    expect(seen).toEqual(["1"]);
    await vi.advanceTimersByTimeAsync(60);
    expect(seen).toEqual(["1", "2"]);
    expect(calls[1]!.headers["Last-Event-ID"]).toBe("7");
    es.close();
    vi.useRealTimers();
  });

  it("closes for good on an error status", async () => {
    const fn = vi.fn(async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    const es = new FetchEventSource("/s", { fetch: fn });
    const errors: number[] = [];
    es.onerror = () => errors.push(es.readyState);
    await vi.waitFor(() => expect(errors).toEqual([FetchEventSource.CLOSED]));
    await tick();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("sseSource with headers", () => {
  it("reads replace envelopes through fetch, with the params in the URL", async () => {
    const { fn, calls } = fakeFetch([['data: {"op":"replace","rows":[{"x":1},{"x":2}]}\n\n']]);
    const src = sseSource({
      url: "http://h/rows",
      headers: { "x-lago-organization": "org" },
      params: { currency: ["EUR", "USD"] },
      fetch: fn,
      throttleMs: 1,
    });
    await vi.waitFor(() => expect(src.rows()).toEqual([{ x: 1 }, { x: 2 }]));
    expect(calls[0]!.url).toBe("http://h/rows?currency=EUR&currency=USD");
    expect(calls[0]!.headers["x-lago-organization"]).toBe("org");
    src.close();
  });
});
