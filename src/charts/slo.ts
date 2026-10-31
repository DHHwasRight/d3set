import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { h } from "./html";
import { matchThreshold, need } from "./util";

/**
 * Service level objective: the share of rows where `y` passes `objective.good`, against `objective.target` (percent).
 * Shows the status, the target, and the error budget left.
 */
export const sloChart: ChartFactory = (el, spec, ctx) => {
  const yField = need(spec, "y");
  if (!spec.objective) throw new Error(`d3set: chart type 'slo' requires field 'objective'.`);
  const { good, target } = spec.objective;
  const pct = d3.format(".2~%");
  el.classList.add("d3s-chart", "d3s-slo");
  el.style.height = `${spec.height ?? 96}px`;
  const value = h("div", "d3s-kpi-value");
  const meta = h("div", "d3s-slo-meta");
  const budgetBar = h("div", "d3s-slo-budget-fill");
  el.append(value, meta, h("div", "d3s-slo-budget", budgetBar));
  let ratio: number | undefined;
  let budget = 1;

  function render() {
    if (ratio === undefined) {
      value.textContent = "–";
      meta.textContent = `Target ${target}%`;
      return;
    }
    const ok = ratio * 100 >= target;
    value.textContent = pct(ratio);
    value.style.color = ok ? "var(--d3s-positive)" : "var(--d3s-negative)";
    meta.textContent = `Target ${target}% · Error budget left ${pct(budget)}`;
    budgetBar.style.width = `${Math.max(0, Math.min(1, budget)) * 100}%`;
    budgetBar.style.background =
      budget > 0.25 ? "var(--d3s-positive)" : budget > 0 ? "var(--d3s-warning)" : "var(--d3s-negative)";
  }

  return {
    update(rows) {
      const values = rows.map((r) => Number(r[yField])).filter(Number.isFinite);
      if (!values.length) ratio = undefined;
      else {
        const goodCount = values.filter((v) => matchThreshold(v, [good as never])).length;
        ratio = goodCount / values.length;
        // Budget: the allowed bad share minus the used bad share, as a part of the allowed share.
        const allowed = 1 - target / 100;
        budget = allowed > 0 ? (allowed - (1 - ratio)) / allowed : ratio === 1 ? 1 : -1;
      }
      render();
    },
    // Colors are CSS vars: the theme's vars on the chart element change them.
    setTheme() {
      render();
    },
    destroy: () => el.replaceChildren(),
  };
};
