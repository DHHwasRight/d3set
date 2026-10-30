// Export the pages of the Rust gallery for the framework galleries.
//
//   GALLERY_NOW=2026-10-01T00:00:00Z GALLERY_ADDR=127.0.0.1:3140 ./target/debug/gallery &
//   node galleries/shared/scripts/export.mjs http://127.0.0.1:3140
//
// Writes galleries/shared/fixtures/original/<page>.json and galleries/shared/public/ (stylesheets,
// fonts, favicon). The Rust gallery runs with a fixed clock, or each export differs. Its library
// switch is exported as it is; each framework gallery marks its own item (libraries.ts).

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";

const base = process.argv[2] ?? "http://127.0.0.1:3140";
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..");

const KINDS = [
  "timeseries", "line", "area", "bar", "toplist", "change", "table", "pie", "donut", "treemap", "sunburst", "funnel",
  "histogram", "boxplot", "heatmap", "timeheatmap", "scatter", "kpi", "gauge", "slo", "hostmap", "status", "stream", "note",
];
const VIEWS = [
  "subscriptions-active", "subscriptions-new", "subscriptions-churn", "revenue-streams", "revenue-mrr",
  "credit-ledgers", "usage", "payments", "dunnings", "invoices",
];
export const PAGES = [
  "/", "/guide", ...KINDS.map((k) => `/charts/${k}`), "/dashboards/ops", "/dashboards/sales", "/analytics",
  ...VIEWS.map((v) => `/analytics/${v}`),
];

/** Fingerprinted names (`gallery.b59ab6ff.css`) lose the fingerprint (`gallery.css`). */
const plain = (url) => url.replace(/\.[0-9a-f]{8}(\.[a-z0-9]+)$/, "$1");
const assets = new Map();
function asset(url) {
  const name = plain(url);
  assets.set(name, url);
  return name;
}

function attrs(el) {
  const a = {};
  for (const { name, value } of el.attributes) a[name] = value;
  return a;
}

function payload(el) {
  const s = el.querySelector(":scope > script.d3s-payload");
  return s ? JSON.parse(s.textContent) : undefined;
}

/** The width the server drew at: the first SVG's view box. */
function drawnWidth(el, fallback) {
  const vb = el.querySelector("svg")?.getAttribute("viewBox");
  return vb ? Number(vb.split(" ")[2]) : fallback;
}

function tree(node, path) {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return null;
  const tag = node.tagName.toLowerCase();
  if (tag === "script") return null;
  const a = attrs(node);
  if ("data-d3s-chart" in a) {
    const p = payload(node);
    // No payload: a static figure the server drew (the overview's thumbnails). Nothing hydrates it.
    if (!p) return { raw: node.outerHTML, tag };
    delete a["data-d3s-chart"];
    return { chart: p, attrs: a, width: drawnWidth(node, 640) };
  }
  if ("data-d3s-dashboard" in a) {
    const p = payload(node);
    delete a["data-d3s-dashboard"];
    // The dashboard widths of the Rust gallery: `site::DASHBOARD` and `analytics::WIDTH`.
    return { dashboard: p, attrs: a, width: path.startsWith("/analytics") ? 960 : 1080 };
  }
  // Each gallery writes this part itself: its own code, read from its own files.
  if ("data-snippet" in a) return { snippet: a["data-snippet"], tag, attrs: a };
  if (tag === "svg" || tag === "pre") return { raw: node.outerHTML, tag };
  if (tag === "link" && a.href) a.href = asset(a.href);
  return { tag, attrs: a, children: [...node.childNodes].map((c) => tree(c, path)).filter((c) => c !== null) };
}

async function page(path, style) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  const { document } = parseHTML(await res.text());
  if (!document.getElementById("library-switch")) throw new Error(`${path}: no library switch in the top bar`);
  for (const l of document.querySelectorAll('link[rel="stylesheet"], link[rel="icon"]')) asset(l.getAttribute("href"));
  const preload = [...document.querySelectorAll('link[rel="preload"]')].map((l) => asset(l.getAttribute("href")));
  const headStyle = [...document.querySelectorAll("head style")]
    .map((s) => s.textContent.replace(/url\(([^)]+)\)/g, (_, u) => `url(${asset(u)})`))
    .join("\n");
  const body = document.body;
  return {
    path,
    style,
    title: document.title,
    bodyAttrs: { "data-style": body.getAttribute("data-style"), "data-mode": body.getAttribute("data-mode") },
    headStyle,
    preload,
    body: [...body.childNodes].map((c) => tree(c, path)).filter((c) => c !== null),
  };
}

rmSync(join(out, "fixtures"), { recursive: true, force: true });
for (const style of ["original"]) {
  mkdirSync(join(out, "fixtures", style), { recursive: true });
  for (const path of PAGES) {
    const p = await page(path, style);
    const name = path === "/" ? "index" : path.slice(1).replace(/\//g, "__");
    writeFileSync(join(out, "fixtures", style, `${name}.json`), JSON.stringify(p));
  }
}
writeFileSync(join(out, "fixtures", "pages.json"), JSON.stringify(PAGES));

// The stylesheets, fonts, and icon, under the names the fixtures use.
for (const [name, url] of assets) {
  const res = await fetch(`${base}${url}`);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const file = join(out, "public", name);
  mkdirSync(dirname(file), { recursive: true });
  let bytes = Buffer.from(await res.arrayBuffer());
  if (name.endsWith(".css")) bytes = Buffer.from(bytes.toString("utf8").replace(/url\((\/[^)]+)\)/g, (_, u) => `url(${plain(u)})`));
  writeFileSync(file, bytes);
}
console.log(`exported ${PAGES.length} pages, ${assets.size} files`);
