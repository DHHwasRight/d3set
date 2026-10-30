// The node tree of an exported page, as React elements, rendered by Server Components. Charts and
// dashboards are drawn on the server by @d3set/next/server and hydrated in the browser.
import "server-only";
import { createElement, type CSSProperties, type ReactNode } from "react";
import { isChart, isDashboard, isRaw, isSnippet, VOID, type Node, type RawNode } from "@d3set/gallery-shared";
import { GalleryChart } from "./snippets/chart";
import { GalleryDashboard } from "./snippets/dashboard";

/** HTML attribute names React spells differently. */
const RENAMED: Record<string, string> = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
/** Boolean attributes: present means true, whatever the value (`open=""`). */
const BOOLEAN = new Set(["open", "hidden", "disabled", "checked", "selected", "readonly", "required", "multiple"]);

/** A `style` attribute as a React style object. Custom properties (`--d3s-*`) keep their names. */
function styleObject(css: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const name = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!name) continue;
    out[name.startsWith("--") ? name : name.replace(/^-ms-/, "ms-").replace(/-([a-z])/g, (_, c) => c.toUpperCase())] =
      value;
  }
  return out as CSSProperties;
}

/** HTML attributes as React props. Others, such as `aria-*`, `data-*`, and `dp-boost`, pass through. */
function props(attrs: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (name === "style") out.style = styleObject(value);
    else if (BOOLEAN.has(name)) out[name === "readonly" ? "readOnly" : name] = true;
    else out[RENAMED[name] ?? name] = value;
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };

/**
 * Raw HTML (a highlighted `<pre>`, a static thumbnail) as its own element with its inner HTML: no
 * wrapper element, so the markup is exactly the reference's.
 */
function raw(node: RawNode, key: number): ReactNode {
  const open = node.raw.match(/^<[^\s>]+([^>]*)>/);
  const close = `</${node.tag}>`;
  if (!open || !node.raw.endsWith(close)) {
    return <div key={key} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: node.raw }} />;
  }
  const attrs: Record<string, string> = {};
  for (const [, name, value] of open[1]!.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) {
    attrs[name!] = (value ?? "").replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ENTITIES[e]!);
  }
  const html = node.raw.slice(open[0].length, -close.length);
  return createElement(node.tag, { ...props(attrs), key, dangerouslySetInnerHTML: { __html: html } });
}

/**
 * One node. A chart replaces its exported `<figure>`: `<ServerChart>` renders the same figure
 * (`d3s-figure`, the theme's `data-d3s-theme` and custom properties) inside a `display: contents`
 * wrapper. Likewise for a dashboard's `d3s-root`. The live streams of the reference are left out:
 * the gallery has no live data, the rows are the ones the reference drew.
 */
export function render(node: Node, key = 0): ReactNode {
  if (typeof node === "string") return node;
  if (isRaw(node)) return raw(node, key);
  if (isChart(node)) return <GalleryChart key={key} chart={node.chart} width={node.width} />;
  if (isDashboard(node)) return <GalleryDashboard key={key} dashboard={node.dashboard} width={node.width} />;
  // `fill` wrote every part of the page the gallery writes itself.
  if (isSnippet(node)) throw new Error(`gallery: part "${node.snippet}" not filled`);
  const children = VOID.has(node.tag) ? undefined : node.children.map(render);
  return createElement(node.tag, { ...props(node.attrs), key }, children);
}
