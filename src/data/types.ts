export type Row = Record<string, unknown>;

export type SourceState = "idle" | "connecting" | "open" | "error" | "closed";

export interface DataSource {
  /** Current rows. */
  rows(): Row[];
  /** Listen for row changes. Called once at once with the current rows. Returns an unsubscribe function. */
  subscribe(listener: (rows: Row[]) => void): () => void;
  /** Listen for connection state changes. */
  onState(listener: (state: SourceState) => void): () => void;
  /** Change server-side parameters (for example, filters). Sources that do not support it ignore the call. */
  setParams(params: Record<string, string | string[]>): void;
  close(): void;
}

/**
 * How a pushed message changes the rows.
 * - `replace`: the message is the full data set.
 * - `append`: add the rows at the end.
 * - `upsert`: replace rows with the same key, add the others.
 */
export type MergeMode = "replace" | "append" | "upsert";

/** A message can carry its own operation: `{ "op": "upsert", "rows": [...] }`. */
export interface Envelope {
  op: MergeMode;
  rows: Row[] | Row;
}
