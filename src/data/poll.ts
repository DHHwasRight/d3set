import { mergeRows, type MergeOptions } from "./merge";
import { SourceStore } from "./store";
import type { DataSource, Row } from "./types";

export interface PollSourceOptions extends Partial<MergeOptions> {
  /** A JSON file: a timeline (`{ interval, frames }`) or one message, like one server-sent event. */
  url: string;
  /** Milliseconds between fetches, or between frames. A timeline's own `interval` wins. Default: 2000. */
  interval?: number;
  /** Rows to start from, for example rows a server rendered into the page. */
  initial?: Row[];
  /** For tests and non-browser hosts. */
  fetch?: typeof fetch;
}

/** A file that replays a feed: one frame per `interval`, in a loop. */
export interface Timeline {
  interval?: number;
  /** Each frame is one message: rows, one row, or an envelope `{ op, rows }`. */
  frames: unknown[];
  /**
   * Make each loop new data instead of the same rows again. On pass `j` (0 for the first pass
   * since the source started), each `time` field moves forward by `j` loops (`interval *
   * frames.length` ms) and each `key` becomes unique to the pass: a number moves past every key
   * of the file, a string gets `#j`. Without it, an upsert by key changes nothing after one loop.
   */
  shift?: TimelineShift;
}

export interface TimelineShift {
  /** Time fields: numbers (ms) or ISO strings. An ISO string keeps its format. */
  time?: string | string[];
  /** The row identity field. */
  key?: string;
}

function isTimeline(v: unknown): v is Timeline {
  return typeof v === "object" && v !== null && Array.isArray((v as Timeline).frames);
}

function rowsOf(message: unknown): Row[] {
  const inner =
    typeof message === "object" && message !== null && "op" in message && "rows" in message
      ? (message as { rows: unknown }).rows
      : message;
  return (Array.isArray(inner) ? inner : [inner]) as Row[];
}

/** The span of the numeric keys of every frame: pass `j` adds `j * span` to a numeric key. */
function keySpan(frames: unknown[], key: string): number {
  let min = Infinity;
  let max = -Infinity;
  for (const frame of frames) {
    for (const row of rowsOf(frame)) {
      const v = row?.[key];
      if (typeof v === "number") {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
  }
  return max >= min ? max - min + 1 : 0;
}

/** `iso` moved by `ms`, in the same format: a date, or a date-time with the same fraction digits and zone. */
function shiftIso(iso: string, ms: number): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(Date.parse(iso + "T00:00:00Z") + ms).toISOString().slice(0, 10);
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(iso);
  if (!m) return iso;
  const zone = m[3] ?? "";
  // Without a zone, the wall time is read as UTC: the result must not depend on the viewer's zone.
  const t = Date.parse(zone ? iso : iso + "Z");
  if (Number.isNaN(t)) return iso;
  const offsetMin =
    zone === "" || zone === "Z"
      ? 0
      : (zone[0] === "-" ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(-2)));
  // The wall time in the original zone, written with the original suffix.
  const wall = new Date(t + ms + offsetMin * 60_000).toISOString();
  const digits = m[2] ? m[2].length - 1 : 0;
  const frac = digits > 0 ? "." + wall.slice(20, 23).padEnd(digits, "0").slice(0, digits) : "";
  return wall.slice(0, m[1]!.length) + frac + zone;
}

/** One frame for pass `pass`: time fields moved by `pass` loops, keys unique to the pass. */
function shifted(message: unknown, shift: TimelineShift, pass: number, loopMs: number, span: number): unknown {
  if (pass === 0) return message;
  const times = shift.time === undefined ? [] : Array.isArray(shift.time) ? shift.time : [shift.time];
  const move = (row: Row): Row => {
    if (typeof row !== "object" || row === null) return row;
    const next: Row = { ...row };
    for (const f of times) {
      const v = next[f];
      if (typeof v === "number") next[f] = v + pass * loopMs;
      else if (typeof v === "string") next[f] = shiftIso(v, pass * loopMs);
    }
    if (shift.key !== undefined) {
      const k = next[shift.key];
      if (typeof k === "number") next[shift.key] = k + pass * span;
      else if (typeof k === "string") next[shift.key] = `${k}#${pass}`;
    }
    return next;
  };
  const isEnvelope = typeof message === "object" && message !== null && "op" in message && "rows" in message;
  const inner = isEnvelope ? (message as { rows: unknown }).rows : message;
  const rows = Array.isArray(inner) ? inner.map((r) => move(r as Row)) : move(inner as Row);
  return isEnvelope ? { ...(message as object), rows } : rows;
}

function resolve(url: string): string {
  const base =
    typeof document !== "undefined" ? document.baseURI : typeof location !== "undefined" ? location.href : undefined;
  return base ? new URL(url, base).toString() : url;
}

/**
 * A source that fetches a JSON file, for hosts that only serve files (GitHub Pages, a bucket).
 *
 * A timeline file plays one frame per interval, from its first frame: the frames continue the rows
 * the page was drawn with. At the end of each loop the file is fetched again with
 * `If-None-Match` (a new deploy brings new frames), and `shift` makes the next pass new rows.
 * Any other file is one message, fetched again every interval.
 */
export function pollSource(opts: PollSourceOptions): DataSource {
  const doFetch = opts.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!doFetch) throw new Error("d3set: pollSource: no fetch implementation is available.");

  const store = new SourceStore();
  if (opts.initial) store.setRows(opts.initial);
  const merge: MergeOptions = { mode: opts.mode ?? "append", key: opts.key, maxRows: opts.maxRows };
  const url = resolve(opts.url);
  let interval = opts.interval ?? 2000;
  let etag: string | undefined;
  let frames: unknown[] | undefined;
  let shift: TimelineShift | undefined;
  let span = 0;
  /** The next frame to play, and how many times the timeline wrapped since the source started. */
  let next = 0;
  let pass = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const apply = (message: unknown) => store.setRows(mergeRows(store.rows(), message, merge));

  /** Fetch the file. A 304 keeps what is loaded; an error throws. */
  const load = async (): Promise<void> => {
    const res = await doFetch(url, { headers: etag ? { "If-None-Match": etag } : {} });
    if (res.status === 304) return;
    if (!res.ok) throw new Error(`d3set: pollSource: GET ${url} answered ${res.status}.`);
    const body: unknown = await res.json();
    etag = res.headers.get("etag") ?? undefined;
    if (isTimeline(body)) {
      frames = body.frames;
      if (body.interval && body.interval > 0) interval = body.interval;
      shift = body.shift;
      span = shift?.key !== undefined ? keySpan(frames, shift.key) : 0;
    } else {
      frames = undefined;
      shift = undefined;
      apply(body);
    }
  };

  const schedule = () => {
    if (closed) return;
    timer = setTimeout(tick, interval);
  };

  const playFrame = () => {
    if (!frames || frames.length === 0) return;
    const frame = frames[next];
    apply(shift ? shifted(frame, shift, pass, interval * frames.length, span) : frame);
    next += 1;
    if (next >= frames.length) {
      next = 0;
      pass += 1;
    }
  };

  const tick = async () => {
    timer = undefined;
    if (closed) return;
    try {
      // The file at the start of each loop: the first tick, and after the last frame.
      if (!frames || frames.length === 0 || next === 0) {
        await load();
        if (frames && next >= frames.length) next = 0;
      }
      if (closed) return;
      playFrame();
      store.setState("open");
    } catch (err) {
      console.warn("d3set: pollSource: fetch failed, retrying.", err);
      store.setState("error");
    }
    schedule();
  };

  store.setState("connecting");
  void tick();

  return {
    rows: () => store.rows(),
    subscribe: (l) => store.subscribe(l),
    onState: (l) => store.onState(l),
    // A file has no server-side parameters.
    setParams() {},
    close() {
      closed = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      store.setState("closed");
    },
  };
}
