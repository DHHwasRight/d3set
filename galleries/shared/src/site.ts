// Where a gallery is published, and the data it reads there. In dev each gallery runs at the root
// of its own port with fixed rows. On GitHub Pages (`build:pages`) each one sits under a base path
// (`/d3set/vanilla`) and its charts replay the Rust gallery's feeds from static JSON files.
//
//   GALLERY_BASE=/d3set/vanilla   the gallery's own path prefix ("" in dev)
//   GALLERY_STATIC=1              charts poll `<GALLERY_DATA_BASE>/data/<feed>.json`
//   GALLERY_DATA_BASE=/d3set      where the Rust gallery's export writes data/

import type { StreamOption } from "d3set/core";
import { isChart, isDashboard, isElement, type Node } from "./fixture.ts";

/** The site settings of a build, from the environment of `vite build` or `next build`. */
export interface Site {
  /** Path prefix of the gallery, without a trailing slash: "" or "/d3set/vanilla". */
  base: string;
  /** Prefix of the static data files, or `null` for fixed rows (dev). */
  data: string | null;
}

/** The settings from `GALLERY_BASE`, `GALLERY_STATIC` and `GALLERY_DATA_BASE`. */
export function siteFromEnv(env: Record<string, string | undefined>): Site {
  const trim = (s: string | undefined) => (s ?? "").replace(/\/+$/, "");
  return {
    base: trim(env.GALLERY_BASE),
    data: env.GALLERY_STATIC === "1" ? trim(env.GALLERY_DATA_BASE) : null,
  };
}

/** Whether `pathname` is a page of the gallery at `base`. */
export function inBase(pathname: string, base: string): boolean {
  return !base || pathname === base || pathname.startsWith(`${base}/`);
}

/** The page path of `pathname`: the base removed, no trailing slash. `/d3set/vanilla/charts/bar/` → `/charts/bar`. */
export function stripBase(pathname: string, base: string): string {
  const path = base && inBase(pathname, base) ? pathname.slice(base.length) : pathname;
  return path.replace(/\/+$/, "") || "/";
}

/** The page links of the tree under `base`: every `href` and `src` that starts with one `/`. */
export function withBase(nodes: Node[], base: string): Node[] {
  if (!base) return nodes;
  const fix = (v: string) => (v.startsWith("/") && !v.startsWith("//") ? `${base}${v}` : v);
  return nodes.map((n) => {
    if (!isElement(n)) return n;
    const attrs = { ...n.attrs };
    for (const name of ["href", "src"]) if (attrs[name] !== undefined) attrs[name] = fix(attrs[name]!);
    return { ...n, attrs, children: withBase(n.children, base) };
  });
}

/**
 * The live data of the charts. The fixtures carry the Rust gallery's server-sent events
 * (`/events/sales?since=…`). With `data` set, each becomes a poll of the feed's static timeline,
 * `<data>/data/sales.json`; with `null` (dev) the stream is removed and the rows stay fixed.
 */
export function withStreams(nodes: Node[], data: string | null): Node[] {
  return nodes.map((n) => {
    if (isChart(n)) return { ...n, chart: { ...n.chart, stream: stream(n.chart.stream, data) } };
    if (isDashboard(n)) return { ...n, dashboard: { ...n.dashboard, stream: stream(n.dashboard.stream, data) } };
    if (!isElement(n)) return n;
    return { ...n, children: withStreams(n.children, data) };
  });
}

function stream(s: StreamOption | undefined, data: string | null): StreamOption | undefined {
  if (!s || data === null) return undefined;
  const { url, maxRows, mode, key } = typeof s === "string" ? { url: s } : s;
  const feed = /\/events\/([^/?#]+)/.exec(url)?.[1];
  if (!feed) return undefined;
  return { url: `${data}/data/${feed}.json`, transport: "poll", maxRows, mode, key };
}
