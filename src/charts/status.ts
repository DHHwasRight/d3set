import * as d3 from "d3";
import type { Row } from "../data/types";
import type { ChartFactory, Level } from "./types";
import { h, htmlBody, timeFormat } from "./html";
import { asDate, levelColor, matchThreshold, need } from "./util";

const levels: Level[] = ["ok", "warning", "critical"];

/**
 * Datadog-style check status: one tile per `x` value with its latest status.
 * The status comes from `y`: a level string (`ok`, `warning`, `critical`), or a number tested
 * against `thresholds` (no match means `ok`). `series` names a timestamp field for "last seen".
 */
export const statusChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const fmt = d3.format(spec.format ?? ".3~s");
  const body = htmlBody(el, spec.height ?? 160, "d3s-status-grid");
  let latest: Array<{ name: string; level: Level; value: unknown; seen?: Date }> = [];

  const levelOf = (v: unknown): Level => {
    if (typeof v === "string" && (levels as string[]).includes(v)) return v as Level;
    return matchThreshold(Number(v), spec.thresholds)?.level ?? "ok";
  };

  function render() {
    const counts = d3.rollup(
      latest,
      (v) => v.length,
      (d) => d.level,
    );
    const summary = h(
      "div",
      "d3s-status-summary",
      ...levels.map((l) => {
        const chip = h("span", "", `${counts.get(l) ?? 0} ${l}`);
        chip.style.setProperty("--dot", levelColor(theme, l));
        return chip;
      }),
    );
    body.replaceChildren(
      summary,
      h(
        "div",
        "d3s-status-tiles",
        ...latest.map((d) => {
          const tile = h(
            "div",
            "d3s-status-tile",
            h("strong", "", d.name),
            h("span", "", typeof d.value === "number" ? fmt(d.value) : String(d.value ?? "")),
            ...(d.seen ? [h("small", "", timeFormat(d.seen))] : []),
          );
          tile.dataset.level = d.level;
          tile.style.setProperty("--level", levelColor(theme, d.level));
          tile.title = `${d.name}: ${d.level}`;
          return tile;
        }),
      ),
    );
  }

  return {
    update(rows: Row[]) {
      // Rows arrive in time order: the last row per entity is its current state.
      const last = new Map<string, Row>();
      for (const r of rows) last.set(String(r[xField]), r);
      latest = [...last]
        .map(([name, r]) => ({
          name,
          value: r[yField],
          level: levelOf(r[yField]),
          seen: spec.series ? asDate(r[spec.series]) : undefined,
        }))
        // Worst first, then by name.
        .sort(
          (a, b) =>
            levels.indexOf(b.level) - levels.indexOf(a.level) ||
            a.name.localeCompare(b.name, undefined, { numeric: true }),
        );
      render();
    },
    setTheme(next) {
      theme = next;
      render();
    },
    destroy: () => body.remove(),
  };
};
