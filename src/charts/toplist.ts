import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { h, htmlBody } from "./html";
import { need, rollup, valueColor } from "./util";

/**
 * Ranked list of `x` values by the aggregate of `y` (default `sum`), largest first.
 * `limit` sets the number of lines (default 10). `thresholds` color the bars.
 * `options.ascending: true` lists the smallest first.
 */
export const toplistChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const fmt = d3.format(spec.format ?? ".3~s");
  const body = htmlBody(el, spec.height ?? 240, "d3s-toplist");
  let entries: Array<[string, number]> = [];

  function render() {
    const max = d3.max(entries, (e) => Math.abs(e[1])) || 1;
    body.replaceChildren(
      ...entries.map(([name, value], i) => {
        const bar = h("div", "d3s-toplist-bar");
        bar.style.width = `${(Math.abs(value) / max) * 100}%`;
        bar.style.background = valueColor(theme, value, spec.thresholds, theme.color.accent);
        const row = h(
          "div",
          "d3s-toplist-row",
          h("span", "d3s-toplist-rank", String(i + 1)),
          h("span", "d3s-toplist-name", name),
          h("span", "d3s-toplist-value", fmt(value)),
          bar,
        );
        row.title = `${name}: ${fmt(value)}`;
        return row;
      }),
    );
  }

  return {
    update(rows) {
      const sign = spec.options?.ascending ? 1 : -1;
      entries = rollup(rows, (r) => String(r[xField]), yField, spec.aggregate ?? "sum")
        .sort((a, b) => sign * (a[1] - b[1]))
        .slice(0, spec.limit ?? 10);
      render();
    },
    setTheme(next) {
      theme = next;
      render();
    },
    destroy: () => body.remove(),
  };
};
