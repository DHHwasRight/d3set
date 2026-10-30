// The library switch of the top bar: one link per gallery (vanilla, Rust, React, Next.js), each to
// the same page in that gallery. The Rust gallery renders it with its own item current; each
// framework gallery marks its own item and points the links at the current page.
//
//   GALLERY_LIBRARIES=vanilla=https://…,rsx=https://…   (partial: the others keep their default)

import { isElement, type ElementNode, type Node } from "./fixture.ts";
import { stripBase } from "./site.ts";

export type Library = "vanilla" | "rsx" | "react" | "next";

/** The galleries, in the order of the switch. */
export const LIBRARIES: Library[] = ["vanilla", "rsx", "react", "next"];

/** Where each gallery runs by default. */
export const DEFAULT_BASES: Record<Library, string> = {
  vanilla: "http://localhost:3300",
  rsx: "http://localhost:3000",
  react: "http://localhost:3310",
  next: "http://localhost:3320",
};

/** The bases of `GALLERY_LIBRARIES` (`id=url,…`) over the defaults. */
export function parseLibraries(env?: string): Record<Library, string> {
  const bases = { ...DEFAULT_BASES };
  for (const pair of (env ?? "").split(",")) {
    const i = pair.indexOf("=");
    if (i < 0) continue;
    const id = pair.slice(0, i).trim() as Library;
    const url = pair
      .slice(i + 1)
      .trim()
      .replace(/\/+$/, "");
    if (LIBRARIES.includes(id) && url) bases[id] = url;
  }
  return bases;
}

/** The page with the switch marking `own` as current and every link to `path` in its gallery. */
export function markLibrary(nodes: Node[], own: Library, bases: Record<Library, string>, path: string): Node[] {
  return nodes.map((n) => {
    if (!isElement(n)) return n;
    if (n.attrs.id === "library-switch") return { ...n, children: n.children.map((c) => link(c, own, bases, path)) };
    return { ...n, children: markLibrary(n.children, own, bases, path) };
  });
}

function link(n: Node, own: Library, bases: Record<Library, string>, path: string): Node {
  if (!isElement(n) || n.tag !== "a") return n;
  const id = n.attrs["data-library"] as Library;
  const { "aria-current": _, ...attrs } = n.attrs;
  const out: ElementNode = { ...n, attrs: { ...attrs, href: `${bases[id] ?? ""}${path}` } };
  if (id === own) out.attrs["aria-current"] = "page";
  return out;
}

/**
 * Keep the switch's links on the page shown now (a hash or query changed since the page was
 * built): each click points the link at its gallery's base and the current path, without this
 * gallery's own path prefix (`own`, "" in dev). Returns the listener's removal.
 */
export function followLibrarySwitch(bases: Record<Library, string>, own = ""): () => void {
  const onClick = (event: Event) => {
    const a = (event.target as Element | null)?.closest?.("#library-switch a[data-library]");
    if (!(a instanceof HTMLAnchorElement)) return;
    const base = bases[a.dataset.library as Library];
    if (base) a.href = `${base}${stripBase(location.pathname, own)}${location.search}`;
  };
  // Capture: the link is right before the gallery's own link handling reads it.
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
