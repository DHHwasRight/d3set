import type { Envelope, MergeMode, Row } from "./types";

export interface MergeOptions {
  mode: MergeMode;
  /** Field that identifies a row. Required for `upsert`. */
  key?: string;
  /** Keep only the last N rows. */
  maxRows?: number;
}

function isEnvelope(v: unknown): v is Envelope {
  return typeof v === "object" && v !== null && "op" in v && "rows" in v;
}

/** Apply one pushed payload to the current rows. Pure: returns a new array. */
export function mergeRows(current: Row[], payload: unknown, opts: MergeOptions): Row[] {
  let mode = opts.mode;
  let incoming: unknown = payload;
  if (isEnvelope(payload)) {
    mode = payload.op;
    incoming = payload.rows;
  }
  const rows = (Array.isArray(incoming) ? incoming : [incoming]) as Row[];

  let next: Row[];
  switch (mode) {
    case "replace":
      next = rows.slice();
      break;
    case "append":
      next = current.concat(rows);
      break;
    case "upsert": {
      const key = opts.key;
      if (!key) throw new Error("d3set: mergeRows: mode 'upsert' requires option 'key'.");
      const index = new Map(current.map((r, i) => [r[key], i]));
      next = current.slice();
      for (const r of rows) {
        const i = index.get(r[key]);
        if (i === undefined) {
          index.set(r[key], next.length);
          next.push(r);
        } else {
          next[i] = r;
        }
      }
      break;
    }
  }
  if (opts.maxRows !== undefined && next.length > opts.maxRows) next = next.slice(next.length - opts.maxRows);
  return next;
}
