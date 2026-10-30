// The parts of the pages each gallery writes for itself. The Rust gallery marks them with
// `data-snippet` (the overview's intro, the guide's steps, the code of a chart page, and the words
// that say how a page is drawn: a chart page's callout, an example's feed, "rendered on the
// server"); everything
// else on a page is common and comes from the export. A gallery describes its own parts in a
// `Docs` value: words, and the paths of the source files whose code to show. Those files are the
// gallery's own code, read and highlighted when the gallery builds (`readSnippets`), so a page
// always shows the code that drew it.

import { isElement, isSnippet, type ElementNode, type Node } from "./fixture.ts";

export type Block =
  | { h1: string }
  | { lead: string }
  | { h2: string }
  /** A paragraph. `code` in backticks becomes `<code>`. */
  | { p: string }
  /** Text inside the element of the part, without a paragraph. */
  | { text: string }
  /** A badge, as in a chart page's callout. `live`: the colored one. */
  | { badge: string; live?: boolean }
  /** The three cards of the overview. */
  | { modes: Array<{ tag: string; title: string; text: string }> }
  /** A source file, by its path from the repository root, shown whole. */
  | { code: string }
  /** A chart page's code section: a title, a note, and a source file. */
  | { section: { title: string; note: string; code: string } };

/** The `data-snippet` names of the Rust gallery's pages. */
export type Slot = "intro" | "guide" | "chart" | "mode" | "feed" | "rendered";

export interface Docs {
  /** The `<title>` of every page. */
  title: string;
  /** What the gallery writes in each part. Empty: the part stays empty. */
  parts: Record<Slot, Block[]>;
}

/** A source file, highlighted. */
export interface Code {
  path: string;
  /** The language, as the summary of the code block names it. */
  lang: string;
  /** A highlighted `<pre>`. */
  html: string;
}

/** Highlighted source files, by path. */
export type Snippets = Record<string, Code>;

/** Every source file `docs` shows. */
export function codePaths(docs: Docs): string[] {
  const paths = Object.values(docs.parts)
    .flat()
    .flatMap((b) => ("code" in b ? [b.code] : "section" in b ? [b.section.code] : []));
  return [...new Set(paths)];
}

const el = (tag: string, attrs: Record<string, string>, ...children: Node[]): ElementNode => ({
  tag,
  attrs,
  children,
});

/** Text with `code` spans, as nodes. */
function text(s: string): Node[] {
  return s.split("`").map((part, i) => (i % 2 ? el("code", {}, part) : part));
}

/** A source file as the Rust gallery shows one: its path and language above, the code open below. */
function source(path: string, snippets: Snippets): Node {
  const code = snippets[path];
  if (!code) throw new Error(`docs: no snippet ${path}: is it in codePaths()?`);
  return el(
    "details",
    { class: "code", open: "" },
    el("summary", {}, `${code.path} `, el("span", { class: "lang" }, code.lang)),
    { raw: code.html, tag: "pre" },
  );
}

function block(b: Block, snippets: Snippets): Node | Node[] {
  if ("h1" in b) return el("h1", {}, ...text(b.h1));
  if ("lead" in b) return el("p", { class: "lead" }, ...text(b.lead));
  if ("h2" in b) return el("h2", {}, ...text(b.h2));
  if ("p" in b) return el("p", {}, ...text(b.p));
  if ("text" in b) return text(b.text);
  if ("badge" in b) return el("span", { class: b.live ? "badge badge-live" : "badge" }, b.badge);
  if ("code" in b) return source(b.code, snippets);
  if ("modes" in b) {
    return el(
      "div",
      { class: "modes" },
      ...b.modes.map((m) =>
        el(
          "div",
          { class: "mode" },
          el("div", { class: "mode-tag" }, m.tag),
          el("h3", {}, ...text(m.title)),
          el("p", {}, ...text(m.text)),
        ),
      ),
    );
  }
  const s = b.section;
  return el(
    "section",
    { class: "example" },
    el("h2", {}, s.title),
    el("p", { class: "muted" }, ...text(s.note)),
    source(s.code, snippets),
  );
}

/** The page with its `data-snippet` parts written by this gallery's `docs`. */
export function fill(nodes: Node[], docs: Docs, snippets: Snippets): Node[] {
  return nodes.map((n) => {
    if (isSnippet(n)) {
      const blocks = docs.parts[n.snippet as Slot];
      if (!blocks) throw new Error(`docs: no part "${n.snippet}"`);
      return el(n.tag, n.attrs, ...blocks.flatMap((b) => block(b, snippets)));
    }
    return isElement(n) ? { ...n, children: fill(n.children, docs, snippets) } : n;
  });
}
