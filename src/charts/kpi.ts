import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { aggregate } from "./util";

/** A single big number, for example total revenue. Default aggregate: `sum`. */
export const kpiChart: ChartFactory = (el, spec) => {
  el.classList.add("d3s-chart", "d3s-kpi");
  el.style.height = `${spec.height ?? 96}px`;
  const value = document.createElement("div");
  value.style.cssText = "font-size:2.5em;font-weight:600;font-variant-numeric:tabular-nums;color:var(--d3s-text)";
  el.append(value);
  const fmt = d3.format(spec.format ?? ",.0f");
  return {
    update(rows) {
      value.textContent = fmt(aggregate(rows.map((r) => Number(r[spec.y])), spec.aggregate ?? "sum"));
    },
    setTheme() {},
    destroy: () => value.remove(),
  };
};
