// The pages of the Rust gallery, exported (scripts/export.mjs) for the framework galleries. Each
// gallery renders the same tree with its own framework and mounts the charts with its own d3set
// binding, so the conformity tests (e2e/conformity.spec.ts) can compare them with the original.

import type { ChartPayload, DashboardPayload } from "d3set/core";

/** An element of the page, its attributes as written in the HTML. */
export interface ElementNode {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
}

/** HTML kept as it is: SVG drawn on the server (thumbnails) and highlighted code. */
export interface RawNode {
  raw: string;
  /** The tag of the element `raw` is. */
  tag: string;
}

/** A chart to draw, with the width the Rust gallery drew it at. */
export interface ChartNode {
  chart: ChartPayload;
  /** Attributes of the `<figure>`, without the payload ones. */
  attrs: Record<string, string>;
  width: number;
}

/** A dashboard to draw. */
export interface DashboardNode {
  dashboard: DashboardPayload;
  attrs: Record<string, string>;
  width: number;
}

/**
 * A part of the page that each gallery writes for itself (`data-snippet` in the Rust gallery):
 * its own code and the words about it. See `docs.ts`.
 */
export interface SnippetNode {
  snippet: string;
  tag: string;
  /** Attributes of the element, `data-snippet` included. */
  attrs: Record<string, string>;
}

export type Node = string | ElementNode | RawNode | ChartNode | DashboardNode | SnippetNode;

export interface Page {
  path: string;
  style: Style;
  title: string;
  /** `data-style` and `data-mode` of `<body>`. */
  bodyAttrs: Record<string, string>;
  /** Inline `<style>` of `<head>` (self-hosted fonts, if any), fonts rewritten to /fonts/. */
  headStyle: string;
  /** Preloaded fonts: `/fonts/...` URLs. */
  preload: string[];
  /** Everything inside `<body>` but the scripts. */
  body: Node[];
}

/** The framework galleries have one design: the Original one, without a style selector. */
export type Style = "original";
export const STYLES: Style[] = ["original"];

export function isElement(n: Node): n is ElementNode {
  return typeof n === "object" && "tag" in n && "children" in n;
}
export function isRaw(n: Node): n is RawNode {
  return typeof n === "object" && "raw" in n;
}
export function isChart(n: Node): n is ChartNode {
  return typeof n === "object" && "chart" in n;
}
export function isSnippet(n: Node): n is SnippetNode {
  return typeof n === "object" && "snippet" in n;
}
export function isDashboard(n: Node): n is DashboardNode {
  return typeof n === "object" && "dashboard" in n;
}

/** The file of a page, under `fixtures/original/`: `/` → `index`, `/charts/bar` → `charts__bar`. */
export function fixtureName(path: string): string {
  return path === "/" ? "index" : path.slice(1).replace(/\//g, "__");
}

/** Void elements: no children, no closing tag. */
export const VOID = new Set(["area", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "wbr"]);
