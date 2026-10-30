// The d3set gallery in plain TypeScript (use case 2): no server rendering, every chart and
// dashboard drawn in the browser with `d3set/core`, and only the chart types of the current page
// loaded with `d3set/lazy`. The pages are the Rust gallery's, exported to JSON
// (galleries/shared/fixtures); this file turns one into DOM and keeps navigation client-side.
import {
  fixtureName,
  isChart,
  isDashboard,
  isRaw,
  isSnippet,
  type ChartNode,
  type DashboardNode,
  type Node,
  type Page,
} from "@d3set/gallery-shared";
import { fill } from "@d3set/gallery-shared/docs";
import { followLibrarySwitch, markLibrary, parseLibraries } from "@d3set/gallery-shared/libraries";
import snippets from "virtual:snippets";
import { docs } from "./docs";
import { drawChart } from "./snippets/chart";
import { drawDashboard } from "./snippets/dashboard";
import { loadChartTypes } from "./snippets/load";

/** One loader per page, in the Original design (the only one here): a chunk each, fetched when first shown. */
const fixtures = import.meta.glob<Page>("../../shared/fixtures/original/*.json", { import: "default" });

/** Where the other galleries run, for the library switch. */
const libraries = parseLibraries(__GALLERY_LIBRARIES__);

/** Charts and dashboards found while building the DOM, drawn once it is in the document. */
interface Pending {
  charts: Array<{ el: HTMLElement; node: ChartNode }>;
  dashboards: Array<{ el: HTMLElement; node: DashboardNode }>;
}

function element(tag: string, attrs: Record<string, string>): HTMLElement {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

/** Turn a node of the page into DOM. Charts get an empty element, drawn later by `draw`. */
function build(node: Node, pending: Pending): globalThis.Node {
  if (typeof node === "string") return document.createTextNode(node);
  if (isRaw(node)) {
    // Server-drawn SVG and highlighted code: parsed as HTML, which handles inline SVG.
    const t = document.createElement("template");
    t.innerHTML = node.raw;
    return t.content.firstChild ?? document.createTextNode("");
  }
  if (isChart(node)) {
    const el = element("figure", node.attrs);
    pending.charts.push({ el, node });
    return el;
  }
  if (isDashboard(node)) {
    const el = element("div", node.attrs);
    pending.dashboards.push({ el, node });
    return el;
  }
  // `fill` wrote every part of the page the gallery writes itself.
  if (isSnippet(node)) throw new Error(`gallery: part "${node.snippet}" not filled`);
  const el = element(node.tag, node.attrs);
  for (const child of node.children) el.append(build(child, pending));
  return el;
}

/** Remove the previous page's charts and dashboards. */
let teardown: Array<() => void> = [];

/** Draw every chart and dashboard of the page, once their chart types are loaded. */
async function draw(pending: Pending, current: () => boolean): Promise<void> {
  await loadChartTypes(
    pending.charts.map(({ node }) => node.chart),
    pending.dashboards.map(({ node }) => node.dashboard),
  );
  // A newer navigation replaced this page while its chart types loaded.
  if (!current()) return;
  for (const { el, node } of pending.charts) {
    const mounted = drawChart(el, node.chart);
    teardown.push(() => mounted.destroy());
  }
  for (const { el, node } of pending.dashboards) teardown.push(drawDashboard(el, node.dashboard));
}

/** The `<head>` part of a page: title, inline style and font preloads (both empty in Original). */
function head(page: Page): void {
  document.title = docs.title;
  document.getElementById("page-style")!.textContent = page.headStyle;
  document.querySelectorAll("link[data-page-preload]").forEach((l) => l.remove());
  for (const href of page.preload) {
    const link = Object.assign(document.createElement("link"), { rel: "preload", href, as: "font" });
    link.type = "font/woff2";
    link.crossOrigin = "";
    link.dataset.pagePreload = "";
    document.head.append(link);
  }
}

let navigation = 0;

/** Show the page of the current URL. */
async function render(): Promise<void> {
  const id = ++navigation;
  document.documentElement.dataset.galleryReady = "false";
  teardown.forEach((destroy) => destroy());
  teardown = [];

  const url = new URL(location.href);
  const load = fixtures[`../../shared/fixtures/original/${fixtureName(url.pathname)}.json`];
  // An unknown path shows the overview, as the gallery has no 404 page of its own.
  const page = await (load ?? fixtures["../../shared/fixtures/original/index.json"]!)();
  if (id !== navigation) return;

  head(page);
  for (const [name, value] of Object.entries(page.bodyAttrs)) document.body.setAttribute(name, value);
  const pending: Pending = { charts: [], dashboards: [] };
  // The parts of the page this gallery writes itself: its own code, and the words about it.
  const body = markLibrary(fill(page.body, docs, snippets), "vanilla", libraries, page.path);
  document.body.replaceChildren(...body.map((n) => build(n, pending)));
  if (!url.hash) window.scrollTo(0, 0);

  await draw(pending, () => id === navigation);
  if (id === navigation) document.documentElement.dataset.galleryReady = "true";
}

/** Follow links inside the gallery with history.pushState instead of a full page load. */
document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
  const a = (event.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement) || a.target || a.hasAttribute("download")) return;
  const to = new URL(a.href);
  if (to.origin !== location.origin) return;
  // A jump inside the page: the browser scrolls to it.
  if (to.pathname === location.pathname && to.search === location.search && to.hash) return;
  event.preventDefault();
  history.pushState(null, "", to);
  render().catch((err) => console.error("gallery: navigation:", err));
});

window.addEventListener("popstate", () => {
  render().catch((err) => console.error("gallery: navigation:", err));
});

followLibrarySwitch(libraries);
render().catch((err) => console.error("gallery: first load:", err));
