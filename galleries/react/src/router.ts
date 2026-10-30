// Client-side routing over the History API: links inside the page change the URL with
// pushState, and the app draws the page of the new URL. Back and forward work through popstate.
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

/** The path and query of the current URL. A string, so React can compare snapshots. */
export function useLocation(): { pathname: string; search: string } {
  const href = useSyncExternalStore(subscribe, () => location.pathname + location.search);
  const url = new URL(href, location.origin);
  return { pathname: url.pathname, search: url.search };
}

export function navigate(href: string): void {
  history.pushState(null, "", href);
  listeners.forEach((l) => l());
}

/**
 * Follow same-origin links without a page load. One listener on the document covers every link,
 * also those inside raw HTML that React does not own. Returns the cleanup.
 */
export function interceptLinks(): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = (event.target as Element | null)?.closest?.("a");
    if (!a || a.origin !== location.origin || a.target || a.hasAttribute("download")) return;
    // An anchor on the same page: the browser scrolls to it.
    if (a.pathname === location.pathname && a.search === location.search && a.hash) return;
    event.preventDefault();
    navigate(a.pathname + a.search + a.hash);
  };
  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}
