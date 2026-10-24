import * as d3 from "d3";
import type { ChartFactory } from "./types";
import { h, htmlBody } from "./html";
import { aggregate, need, sequentialColor, textOn, valueColor } from "./util";

/**
 * Datadog-style host map: one hexagon per `x` value (for example a host), colored by the aggregate of `y`
 * (default `last`). `series` groups the hexagons. `thresholds` replace the color scale with status colors.
 */
export const hostmapChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const fmt = d3.format(spec.format ?? ".3~s");
  const body = htmlBody(el, spec.height ?? 240, "d3s-hostmap");
  let groups: Array<[string, Array<[string, number]>]> = [];

  function render() {
    const all = groups.flatMap(([, list]) => list.map((e) => e[1]));
    const scale = sequentialColor(theme, [d3.min(all) ?? 0, d3.max(all) ?? 1]);
    body.replaceChildren(
      ...groups.map(([group, list]) =>
        h(
          "section",
          "d3s-hostmap-group",
          ...(spec.series ? [h("div", "d3s-hostmap-title", group)] : []),
          h(
            "div",
            "d3s-hostmap-tiles",
            ...list.map(([name, value]) => {
              const fill = spec.thresholds
                ? valueColor(theme, value, spec.thresholds, theme.color.positive)
                : scale(value);
              const tile = h("div", "d3s-hex");
              tile.style.background = fill;
              tile.style.color = textOn(fill);
              tile.title = `${name}: ${fmt(value)}`;
              tile.setAttribute("aria-label", tile.title);
              return tile;
            }),
          ),
        ),
      ),
    );
  }

  return {
    update(rows) {
      const how = spec.aggregate ?? "last";
      const agg = (v: typeof rows) =>
        aggregate(
          v.map((r) => Number(r[yField])),
          how,
        );
      const byName = (a: [string, number], b: [string, number]) =>
        a[0].localeCompare(b[0], undefined, { numeric: true });
      groups = spec.series
        ? d3
            .rollups(
              rows,
              agg,
              (r) => String(r[spec.series!]),
              (r) => String(r[xField]),
            )
            .map(([g, list]) => [g, list.sort(byName)] as [string, Array<[string, number]>])
            .sort((a, b) => a[0].localeCompare(b[0]))
        : [["", d3.rollups(rows, agg, (r) => String(r[xField])).sort(byName)]];
      render();
    },
    setTheme(next) {
      theme = next;
      render();
    },
    destroy: () => body.remove(),
  };
};
