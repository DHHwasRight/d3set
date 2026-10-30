// The page tree exported from the Rust gallery, as React elements: elements keep the attributes
// of the HTML, raw HTML goes in as is, and charts and dashboards are drawn by @d3set/react.
import {
  isChart,
  isDashboard,
  isRaw,
  isSnippet,
  VOID,
  type ChartNode,
  type DashboardNode,
  type Node,
  type RawNode,
} from "@d3set/gallery-shared";
import { GalleryChart } from "./snippets/GalleryChart";
import { GalleryDashboard } from "./snippets/GalleryDashboard";
import {
  createContext,
  createElement,
  use,
  useCallback,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

/**
 * Called once by each chart and dashboard of the page when it has drawn: the page counts them to
 * tell when it is ready.
 */
export const Drawn = createContext<() => void>(() => {});

/** The `onReady` of one chart or dashboard: reports to the page once, even if called again. */
function useOnReady(): () => void {
  const drawn = use(Drawn);
  const done = useRef(false);
  return useCallback(() => {
    if (done.current) return;
    done.current = true;
    drawn();
  }, [drawn]);
}

const RENAMED: Record<string, string> = { class: "className", for: "htmlFor", tabindex: "tabIndex" };
const BOOLEAN = new Set(["open", "hidden", "disabled", "checked", "selected"]);

/** `a: b; --c: d` as a React style object: properties in camelCase, custom properties as they are. */
export function styleObject(css: string): CSSProperties {
  const out: Record<string, string> = {};
  // A `;` inside parentheses (a data URL) does not end a declaration.
  for (const decl of css.split(/;(?![^(]*\))/)) {
    const i = decl.indexOf(":");
    const name = decl.slice(0, i).trim();
    if (i < 0 || !name) continue;
    const key = name.startsWith("--")
      ? name
      : name.replace(/^-ms-/, "ms-").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = decl.slice(i + 1).trim();
  }
  return out;
}

/** HTML attributes as React props. Custom attributes (`dp-boost`, `aria-*`, `data-*`) pass as they are. */
export function props(attrs: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (name === "style") out.style = styleObject(value);
    else if (BOOLEAN.has(name)) out[name] = true;
    else out[RENAMED[name] ?? name] = value;
  }
  return out;
}

/** A chart: the `<figure>` is the chart's own element, as in the Rust gallery. */
function Figure({ node }: { node: ChartNode }) {
  const attrs = useMemo(() => props(node.attrs), [node]);
  const onReady = useOnReady();
  return <GalleryChart {...attrs} chart={node.chart} onReady={onReady} />;
}

/** The dashboard element is the `.d3s-root` itself: `<Dashboard>` takes its class and style. */
function Board({ node }: { node: DashboardNode }) {
  const style = useMemo(() => styleObject(node.attrs.style ?? ""), [node]);
  const onReady = useOnReady();
  return <GalleryDashboard dashboard={node.dashboard} className={node.attrs.class} style={style} onReady={onReady} />;
}

/** Raw HTML: the element itself with its attributes, its content set as HTML. */
function Raw({ node }: { node: RawNode }) {
  const el = useMemo(() => {
    const template = document.createElement("template");
    template.innerHTML = node.raw;
    return template.content.firstElementChild!;
  }, [node]);
  const attrs = Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));
  return createElement(node.tag, { ...props(attrs), dangerouslySetInnerHTML: { __html: el.innerHTML } });
}

export function render(nodes: Node[]): ReactNode[] {
  return nodes.map((node, i) => {
    if (typeof node === "string") return node;
    if (isRaw(node)) return <Raw key={i} node={node} />;
    if (isDashboard(node)) return <Board key={i} node={node} />;
    if (isChart(node)) return <Figure key={i} node={node} />;
    // `fill` wrote every part of the page the gallery writes itself.
    if (isSnippet(node)) throw new Error(`gallery: part "${node.snippet}" not filled`);
    const p = { key: i, ...props(node.attrs) };
    return VOID.has(node.tag) ? createElement(node.tag, p) : createElement(node.tag, p, ...render(node.children));
  });
}

/** How many charts and dashboards `nodes` draw: the page is ready when all of them are. */
export function countDrawn(nodes: Node[]): number {
  return nodes.reduce<number>((n, node) => {
    if (typeof node === "string" || isRaw(node) || isSnippet(node)) return n;
    if (isDashboard(node) || isChart(node)) return n + 1;
    return "children" in node ? n + countDrawn(node.children) : n;
  }, 0);
}
