// The gallery's only client script. dp-swap replaces parts of the page without running the scripts
// inside them, so everything a page needs on the client starts here: hydration of the charts the
// server rendered, closing the streams of the page you leave, the library switch, and the swap
// ring. The shell loads this module once; every later page arrives through dp-swap events.

import { hydrateCharts } from "./_src/hydrate.js";
import { followPath } from "./_src/library-switch.js";

// Count live streams before anything opens one. The d3set bundle reads `globalThis.EventSource`
// when a source is created, so the wrapper sees every stream the charts open. The tests read the
// count to prove that leaving a page closes its streams.
const NativeEventSource = window.EventSource;
const streams = new Set();
if (NativeEventSource) {
  window.EventSource = class extends NativeEventSource {
    constructor(...args) {
      super(...args);
      streams.add(this);
    }
    close() {
      streams.delete(this);
      super.close();
    }
  };
}

// Fragments live at the page's own URL; the server picks the tree to send from the DP-Partial
// header. dp-swap starts itself on DOMContentLoaded, which a module script always runs before,
// so configuring here is in time and no explicit start is needed. On a static site the page's
// `<meta name="dp-config">` adds `partialDir` and `base`: dp-swap reads it when it starts, and a
// partial directory wins over the header.
dpswap.configure({ fragmentMode: "header" });

// Each hydration, with what it hydrated. The handle d3set returns does not expose its elements,
// and a hydrated element loses its data-d3s-* attribute, so the elements are noted before the
// call. They decide which handles a swap must destroy.
const handles = new Set();

const SELECTOR = "[data-d3s-dashboard], [data-d3s-chart]";

async function hydrate(root) {
  // querySelectorAll does not match the root itself. If the swapped element is a chart, hydrate
  // from its parent; the other charts there are hydrated already and carry no attribute.
  if (root instanceof Element && root.matches(SELECTOR)) root = root.parentElement ?? root;
  const elements = [...root.querySelectorAll(SELECTOR)];
  if (!elements.length) return;
  const entry = { handle: await hydrateCharts(root), elements };
  handles.add(entry);
  // The bundle import is async: a swap may have removed these elements while it loaded.
  if (!elements.some((el) => el.isConnected)) destroy(entry);
}

function destroy(entry) {
  handles.delete(entry);
  entry.handle.destroy();
}

const ring = document.body.hasAttribute("data-swap-ring");

followPath();
hydrate(document).catch((err) => console.error("gallery: first load:", err));

// The region about to go: close its streams now, while its elements still exist to match. The
// target is the element dp-swap replaces (or empties), after it resolved shared layouts.
document.addEventListener("dp:beforeSwap", (event) => {
  const region = event.target;
  if (!(region instanceof Node)) return;
  for (const entry of [...handles]) {
    if (entry.elements.some((el) => region.contains(el))) destroy(entry);
  }
});

// A navigation request starts: close every live stream now, not at the swap. Over HTTP/1.1 Chrome
// keeps 6 connections per host, and a page with 6 streams would leave the request
// waiting forever. Every navigation replaces the region that holds the charts, so they go anyway.
document.addEventListener("dp:beforeRequest", () => {
  for (const entry of [...handles]) destroy(entry);
});

document.addEventListener("dp:afterSwap", (event) => {
  const el = event.target;
  if (!(el instanceof Element)) return;
  hydrate(el).catch((err) => console.error("gallery: swap:", err));
  if (ring) mark(el);
});

// Belt and braces: a swap style that removes content without a matching beforeSwap target, or a
// history restore, must not leave a stream running for elements nobody can see.
document.addEventListener("dp:afterSettle", () => {
  for (const entry of [...handles]) {
    if (!entry.elements.some((el) => el.isConnected)) destroy(entry);
  }
});

// The swap ring, for demos and debugging (GALLERY_SWAP_RING=1). dp-swap's own settling class
// lasts one microtask, too short for an animation. This class marks the swapped region until its
// own animation ends, so the highlight shows exactly the subtree that was replaced.
function mark(el) {
  el.classList.remove("is-swapped");
  // Reading offsetWidth restarts the animation when the same region swaps twice in a row; without
  // it the class is already present and nothing runs.
  void el.offsetWidth;
  el.classList.add("is-swapped");
  // animationend bubbles, and the swapped-in content has entrance animations of its own. The
  // first of those to finish would end the ring early. Only this element's animation counts.
  const done = (e) => {
    if (e.target !== el) return;
    el.classList.remove("is-swapped");
    el.removeEventListener("animationend", done);
  };
  el.addEventListener("animationend", done);
}

// For the Playwright tests: live hydrations, and streams the browser still holds open. A stream
// the server ended for good counts as closed.
window.d3set = {
  hydrated: () => handles.size,
  streams: () => [...streams].filter((s) => s.readyState !== NativeEventSource.CLOSED).length,
};
