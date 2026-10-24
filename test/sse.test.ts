import { describe, expect, it, vi } from "vitest";
import { sseSource } from "../src/data/sse";
import type { Row } from "../src/data/types";

class FakeEventSource {
  static last: FakeEventSource;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private handlers = new Map<string, (e: MessageEvent) => void>();
  constructor(public url: string) {
    FakeEventSource.last = this;
  }
  addEventListener(name: string, h: (e: MessageEvent) => void) {
    this.handlers.set(name, h);
  }
  emit(name: string, data: unknown) {
    this.handlers.get(name)?.(new MessageEvent(name, { data: JSON.stringify(data) }));
  }
  close() {
    this.readyState = 2;
  }
}

describe("sseSource", () => {
  it("batches pushed events and reconnects with new params", async () => {
    vi.useFakeTimers();
    const src = sseSource({
      url: "http://x/stream",
      throttleMs: 10,
      EventSource: FakeEventSource as never,
    });
    const seen: Row[][] = [];
    src.subscribe((r) => seen.push(r));

    FakeEventSource.last.onopen?.();
    FakeEventSource.last.emit("message", [{ v: 1 }]);
    FakeEventSource.last.emit("message", { v: 2 });
    vi.advanceTimersByTime(10);
    expect(seen.at(-1)).toEqual([{ v: 1 }, { v: 2 }]);
    expect(seen).toHaveLength(2); // initial [] + one batched update

    src.setParams({ region: ["EU", "US"] });
    expect(FakeEventSource.last.url).toBe("http://x/stream?region=EU&region=US");
    expect(src.rows()).toEqual([]);
    vi.useRealTimers();
  });
});
