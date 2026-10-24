import type { ChartFactory } from "./types";
import { h } from "./html";

/** Static text for context on a dashboard. Blank lines split paragraphs. Ignores data. */
export const noteChart: ChartFactory = (el, spec) => {
  el.classList.add("d3s-note");
  for (const para of (spec.text ?? "").split(/\n\s*\n/)) el.append(h("p", "", para.trim()));
  return { update() {}, setTheme() {}, destroy: () => el.replaceChildren() };
};
