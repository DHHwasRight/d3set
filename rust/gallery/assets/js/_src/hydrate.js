// How the gallery makes the server's charts live. The server rendered each chart with its spec
// and rows as JSON; `hydrate` reads them, draws the live chart in place of the markup, and opens
// the chart's stream. The first draw has no transition, so nothing flashes and nothing moves.

// The library without its chart types, imported on first use: a page without charts loads
// nothing. Each chart type is a chunk of its own (`d3set/lazy`).
let library;
const d3set = () =>
  (library ??= Promise.all([import("../../../../../src/core"), import("../../../../../src/lazy")]).then(
    ([core, lazy]) => ({ ...core, ...lazy }),
  ));

/** Hydrate every chart and dashboard under `root`. Returns the handle that destroys them. */
export async function hydrateCharts(root) {
  const { hydrate, loadChartsFor } = await d3set();
  // Load the chart types `root` uses, and only those.
  await loadChartsFor(root);
  return hydrate(root);
}
