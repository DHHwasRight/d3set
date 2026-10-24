import type { Row, SourceState } from "./types";

/** Small shared base for sources: holds rows and state, notifies listeners. */
export class SourceStore {
  private data: Row[] = [];
  private state: SourceState = "idle";
  private rowListeners = new Set<(rows: Row[]) => void>();
  private stateListeners = new Set<(s: SourceState) => void>();

  rows(): Row[] {
    return this.data;
  }

  setRows(rows: Row[]): void {
    this.data = rows;
    for (const l of this.rowListeners) l(rows);
  }

  setState(s: SourceState): void {
    if (s === this.state) return;
    this.state = s;
    for (const l of this.stateListeners) l(s);
  }

  subscribe(listener: (rows: Row[]) => void): () => void {
    this.rowListeners.add(listener);
    listener(this.data);
    return () => this.rowListeners.delete(listener);
  }

  onState(listener: (s: SourceState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }
}
