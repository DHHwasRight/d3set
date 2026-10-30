import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollSource } from "../src/data/poll";
import { streamSource } from "../src/hydrate";
import type { Row, SourceState } from "../src/data/types";

/** A fake server: each GET answers the current file, with an ETag, and 304 when it matches. */
function server(initial: unknown) {
  let body = initial;
  let version = 1;
  let fail = false;
  const calls: { url: string; ifNoneMatch?: string }[] = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, ifNoneMatch: headers["If-None-Match"] });
    if (fail) return new Response("down", { status: 500 });
    const etag = `"v${version}"`;
    if (headers["If-None-Match"] === etag) return new Response(null, { status: 304 });
    return new Response(JSON.stringify(body), { status: 200, headers: { etag } });
  });
  return {
    fetch: fetch as unknown as typeof globalThis.fetch,
    calls,
    publish(next: unknown) {
      body = next;
      version += 1;
    },
    down(v: boolean) {
      fail = v;
    },
  };
}

const ids = (rows: Row[]) => rows.map((r) => r.id);
const frames = (n: number) => Array.from({ length: n }, (_, i) => [{ id: i }]);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("pollSource with a timeline", () => {
  it("starts on the frame the clock points to, then plays one frame per tick", async () => {
    // 4 frames of 1000 ms: at 6500 ms the clock is on step 6, frame 6 % 4 = 2.
    vi.setSystemTime(6500);
    const s = server({ interval: 1000, frames: frames(4) });
    const src = pollSource({ url: "http://x/feed.json", fetch: s.fetch, mode: "replace" });
    await vi.advanceTimersByTimeAsync(0);
    expect(ids(src.rows())).toEqual([2]);
    // The next frame comes on the next boundary (7000), not 1000 ms after the start.
    await vi.advanceTimersByTimeAsync(500);
    expect(ids(src.rows())).toEqual([3]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ids(src.rows())).toEqual([0]);
    src.close();
  });

  it("uses the file's interval over the option", async () => {
    vi.setSystemTime(0);
    const s = server({ interval: 500, frames: frames(10) });
    const src = pollSource({ url: "http://x/feed.json", fetch: s.fetch, interval: 5000, mode: "replace" });
    await vi.advanceTimersByTimeAsync(1500);
    expect(ids(src.rows())).toEqual([3]);
    src.close();
  });

  it("appends frames to the initial rows and keeps maxRows", async () => {
    vi.setSystemTime(0);
    const s = server({ interval: 1000, frames: frames(10) });
    const src = pollSource({ url: "http://x/feed.json", fetch: s.fetch, initial: [{ id: "a" }], maxRows: 3 });
    await vi.advanceTimersByTimeAsync(0);
    expect(ids(src.rows())).toEqual(["a", 0]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(ids(src.rows())).toEqual([0, 1, 2]);
    src.close();
  });

  it("upserts by key, and a frame can carry its own operation", async () => {
    vi.setSystemTime(0);
    const s = server({
      interval: 1000,
      frames: [[{ id: 1, v: 1 }], [{ id: 1, v: 2 }], { op: "replace", rows: [{ id: 9, v: 0 }] }],
    });
    const src = pollSource({ url: "http://x/feed.json", fetch: s.fetch, mode: "upsert", key: "id" });
    await vi.advanceTimersByTimeAsync(0);
    expect(src.rows()).toEqual([{ id: 1, v: 1 }]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(src.rows()).toEqual([{ id: 1, v: 2 }]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(src.rows()).toEqual([{ id: 9, v: 0 }]);
    src.close();
  });

  it("fetches the file again with If-None-Match when the loop wraps: 304 keeps, 200 replaces", async () => {
    vi.setSystemTime(0);
    const s = server({ interval: 1000, frames: frames(2) });
    const src = pollSource({ url: "http://x/feed.json", fetch: s.fetch, mode: "replace" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.calls).toHaveLength(1);
    // 2000: a new loop. Nothing was published: 304, and the old frames play on.
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.calls).toHaveLength(2);
    expect(s.calls[1]!.ifNoneMatch).toBe('"v1"');
    expect(ids(src.rows())).toEqual([0]);
    // A new deploy: the next loop (4000) fetches it and plays the new frames.
    s.publish({ interval: 1000, frames: [[{ id: "new0" }], [{ id: "new1" }]] });
    await vi.advanceTimersByTimeAsync(1000);
    expect(ids(src.rows())).toEqual([1]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.calls).toHaveLength(3);
    expect(ids(src.rows())).toEqual(["new0"]);
    src.close();
  });
});

describe("pollSource with one message", () => {
  it("fetches every interval and applies the file only when it changed", async () => {
    vi.setSystemTime(0);
    const s = server([{ id: 1 }]);
    const src = pollSource({ url: "http://x/rows.json", fetch: s.fetch, interval: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(ids(src.rows())).toEqual([1]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.calls).toHaveLength(2);
    expect(ids(src.rows())).toEqual([1]);
    s.publish({ op: "append", rows: [{ id: 2 }] });
    await vi.advanceTimersByTimeAsync(1000);
    expect(ids(src.rows())).toEqual([1, 2]);
    src.close();
  });
});

describe("pollSource state", () => {
  it("reports an error and retries on the next tick", async () => {
    vi.setSystemTime(0);
    const s = server([{ id: 1 }]);
    s.down(true);
    const states: SourceState[] = [];
    const src = pollSource({ url: "http://x/rows.json", fetch: s.fetch, interval: 1000 });
    src.onState((st) => states.push(st));
    await vi.advanceTimersByTimeAsync(0);
    expect(states.at(-1)).toBe("error");
    s.down(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(states.at(-1)).toBe("open");
    expect(ids(src.rows())).toEqual([1]);
    src.close();
  });

  it("stops fetching once closed", async () => {
    vi.setSystemTime(0);
    const s = server({ interval: 1000, frames: frames(3) });
    const src = pollSource({ url: "http://x/feed.json", fetch: s.fetch });
    await vi.advanceTimersByTimeAsync(0);
    src.close();
    const rows = src.rows();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(s.calls).toHaveLength(1);
    expect(src.rows()).toBe(rows);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves a relative URL against the document base", async () => {
    const base = document.createElement("base");
    base.href = "https://example.github.io/d3set/charts/";
    document.head.append(base);
    try {
      const s = server([]);
      const src = pollSource({ url: "../data/sales.json", fetch: s.fetch });
      await vi.advanceTimersByTimeAsync(0);
      expect(s.calls[0]!.url).toBe("https://example.github.io/d3set/data/sales.json");
      src.close();
    } finally {
      base.remove();
    }
  });
});

describe("streamSource", () => {
  it("picks the poll transport from a payload's stream option", async () => {
    vi.setSystemTime(0);
    const s = server({ interval: 1000, frames: frames(2) });
    vi.stubGlobal("fetch", s.fetch);
    try {
      const src = streamSource({ url: "http://x/feed.json", transport: "poll", mode: "replace" }, [{ id: "ssr" }]);
      expect(ids(src.rows())).toEqual(["ssr"]);
      await vi.advanceTimersByTimeAsync(0);
      expect(ids(src.rows())).toEqual([0]);
      src.close();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("pollSource timeline shift", () => {
  it("moves number times and numeric keys on each new pass", async () => {
    // 2 frames of 1000 ms: one loop is 2000 ms. Keys 10..11: span 2.
    vi.setSystemTime(0);
    const s = server({
      interval: 1000,
      frames: [[{ id: 10, t: 0 }], [{ id: 11, t: 1000 }]],
      shift: { time: "t", key: "id" },
    });
    const src = pollSource({ url: "http://x/feed.json", fetch: s.fetch, mode: "upsert", key: "id" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(src.rows()).toEqual([
      { id: 10, t: 0 },
      { id: 11, t: 1000 },
    ]);
    // Pass 1: new rows, so an upsert by id adds them and the charts move on.
    await vi.advanceTimersByTimeAsync(2000);
    expect(src.rows().slice(2)).toEqual([
      { id: 12, t: 2000 },
      { id: 13, t: 3000 },
    ]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(src.rows().at(-1)).toEqual({ id: 14, t: 4000 });
    src.close();
  });

  it("counts passes from the start of the source, not from the epoch", async () => {
    vi.setSystemTime(10_000); // loop 5 of a 2000 ms timeline
    const s = server({ interval: 1000, frames: [[{ id: "a", t: 0 }], [{ id: "b", t: 1000 }]], shift: { key: "id" } });
    const src = pollSource({ url: "http://x/feed.json", fetch: s.fetch, mode: "upsert", key: "id" });
    await vi.advanceTimersByTimeAsync(0);
    expect(src.rows()).toEqual([{ id: "a", t: 0 }]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(src.rows().map((r) => r.id)).toEqual(["a", "b", "a#1"]);
    src.close();
  });

  it("keeps the format of ISO times and moves them by whole loops", async () => {
    vi.setSystemTime(0);
    const s = server({
      interval: 60_000,
      frames: [
        {
          op: "append",
          rows: [
            {
              id: "x",
              at: "2026-10-01T00:00:00Z",
              local: "2026-10-01T23:59:30.250+02:00",
              day: "2026-10-01",
              naive: "2026-10-01T12:00",
            },
          ],
        },
      ],
      shift: { time: ["at", "local", "day", "naive"], key: "id" },
    });
    const src = pollSource({ url: "http://x/feed.json", fetch: s.fetch });
    await vi.advanceTimersByTimeAsync(60_000);
    // One frame of 60 s: pass 1 moves every time by one minute.
    expect(src.rows()[1]).toEqual({
      id: "x#1",
      at: "2026-10-01T00:01:00Z",
      local: "2026-10-02T00:00:30.250+02:00",
      day: "2026-10-01",
      naive: "2026-10-01T12:01",
    });
    src.close();
  });

  it("changes nothing without shift", async () => {
    vi.setSystemTime(0);
    const s = server({ interval: 1000, frames: [[{ id: 1, t: 0 }]] });
    const src = pollSource({ url: "http://x/feed.json", fetch: s.fetch });
    await vi.advanceTimersByTimeAsync(1000);
    expect(src.rows()).toEqual([
      { id: 1, t: 0 },
      { id: 1, t: 0 },
    ]);
    src.close();
  });
});
