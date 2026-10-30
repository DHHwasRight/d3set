// The library switch links to the current page on the other galleries. Each gallery navigates
// without reloading its shell, so a link's path can be stale: on click, it takes the current one.
//
// A gallery served under a base path (`/d3set` on a static host) has that base in
// `location.pathname`. The link's own base is already in its href, so the current path goes in
// without ours. dp-swap's page config carries the base on a static site; elsewhere it is empty.

export function ownBase(doc = document) {
  try {
    const meta = doc.querySelector('meta[name="dp-config"]');
    const base = meta ? JSON.parse(meta.content).base : "";
    return typeof base === "string" ? base.replace(/\/+$/, "") : "";
  } catch {
    return "";
  }
}

/** `pathname` without `base`: `/d3set/charts/bar` → `/charts/bar`, `/d3set` → `/`. */
export function withoutBase(pathname, base) {
  if (!base || (pathname !== base && !pathname.startsWith(base + "/"))) return pathname;
  return pathname.slice(base.length) || "/";
}

export function followPath(root = document) {
  const base = ownBase();
  root.addEventListener("click", (event) => {
    const link = event.target instanceof Element && event.target.closest(".library-switch a");
    if (!link) return;
    link.href = targetBase(link) + withoutBase(location.pathname, base) + location.search;
  });
}

// The server wrote each href as `base + path`, and the path on the switch (`data-path`): what is
// left of the href is the other gallery's base.
export function targetBase(link) {
  const url = new URL(link.href);
  const rendered = link.closest(".library-switch")?.getAttribute("data-path") ?? "";
  const path = url.pathname;
  const base = rendered && path.endsWith(rendered) ? path.slice(0, path.length - rendered.length) : "";
  return url.origin + base.replace(/\/+$/, "");
}
