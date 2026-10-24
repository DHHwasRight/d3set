import { SourceStore } from "./store";
import type { DataSource, Row } from "./types";

/** A source with fixed rows. Use `set` to push new rows by hand. */
export function staticSource(initial: Row[] = []): DataSource & { set(rows: Row[]): void } {
  const store = new SourceStore();
  store.setRows(initial);
  store.setState("open");
  return {
    rows: () => store.rows(),
    subscribe: (l) => store.subscribe(l),
    onState: (l) => store.onState(l),
    setParams: () => {},
    close: () => store.setState("closed"),
    set: (rows) => store.setRows(rows),
  };
}
