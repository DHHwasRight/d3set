import * as d3 from "d3";
import type { Row } from "../data/types";
import type { ChartFactory } from "./types";
import { h, htmlBody } from "./html";
import { aggregate, asDate, interactionsOf, need, parseInterval, selectOnClick, formatter } from "./util";

interface Change {
  group: string;
  now: number;
  before: number;
  delta: number;
  ratio: number | undefined;
}

/**
 * Datadog-style change view: the aggregate of `y` (default `sum`) in the last `window` (default `1h`)
 * against the window before it, per `series` value. "Now" is the newest `x` timestamp in the data.
 */
export const changeChart: ChartFactory = (el, spec, ctx) => {
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const win = parseInterval(spec.window ?? "1h");
  const how = spec.aggregate ?? "sum";
  const fmt = formatter(spec.format ?? ".3~s");
  const pct = d3.format("+.1%");
  const body = htmlBody(el, spec.height ?? 240, "d3s-change");
  const ix = interactionsOf(ctx);
  let changes: Change[] = [];

  function compute(rows: Row[]): Change[] {
    const times = rows.map((r) => asDate(r[xField])?.getTime() ?? NaN);
    const end = d3.max(times.filter(Number.isFinite));
    if (end === undefined) return [];
    const groups = new Map<string, { now: number[]; before: number[] }>();
    rows.forEach((r, i) => {
      const t = times[i]!;
      const which = t > end - win ? "now" : t > end - 2 * win ? "before" : undefined;
      if (!which) return;
      const key = spec.series ? String(r[spec.series]) : yField;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { now: [], before: [] }));
      g[which].push(Number(r[yField]));
    });
    return [...groups]
      .map(([group, g]) => {
        const now = aggregate(g.now, how);
        const before = aggregate(g.before, how);
        return {
          group,
          now,
          before,
          delta: now - before,
          ratio: before ? (now - before) / Math.abs(before) : undefined,
        };
      })
      .sort((a, b) => Math.abs(b.ratio ?? b.delta) - Math.abs(a.ratio ?? a.delta))
      .slice(0, spec.limit ?? 20);
  }

  function render() {
    const good = (d: number) => (spec.decreaseIsGood ? d < 0 : d > 0);
    body.replaceChildren(
      h(
        "div",
        "d3s-change-head",
        h("span", "", spec.series ?? ""),
        h("span", "", "Now"),
        h("span", "", `vs previous ${spec.window ?? "1h"}`),
      ),
      ...changes.map((c) => {
        const delta = h(
          "span",
          "d3s-change-delta",
          `${c.delta === 0 ? "■" : c.delta > 0 ? "▲" : "▼"} ${fmt(Math.abs(c.delta))}${c.ratio === undefined ? "" : ` (${pct(c.ratio)})`}`,
        );
        if (c.delta !== 0) delta.style.color = good(c.delta) ? "var(--d3s-positive)" : "var(--d3s-negative)";
        const row = h(
          "div",
          "d3s-change-row",
          h("span", "d3s-change-name", c.group),
          h("span", "d3s-change-now", fmt(c.now)),
          delta,
        );
        row.title = `${c.group}: ${fmt(c.before)} → ${fmt(c.now)}`;
        selectOnClick(row, ix, spec.series, c.group);
        return row;
      }),
    );
  }

  return {
    update(rows) {
      changes = compute(rows);
      render();
    },
    // Colors are CSS vars: the theme's vars on the chart element change them.
    setTheme() {
      render();
    },
    destroy: () => body.remove(),
  };
};
