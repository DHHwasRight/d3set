import type { ChartFactory } from "./types";
import { h, htmlBody, timeFormat } from "./html";
import { asDate, interactionsOf, need, selectOnClick } from "./util";

const levelColors: Record<string, string> = {
  error: "var(--d3s-negative)",
  critical: "var(--d3s-negative)",
  warn: "var(--d3s-warning)",
  warning: "var(--d3s-warning)",
  info: "var(--d3s-accent)",
  ok: "var(--d3s-positive)",
  debug: "var(--d3s-text-muted)",
};

/**
 * Event or log stream: the newest rows first.
 * `x`: timestamp field. `y`: message field. `series`: level field (colors the line).
 * `columns`: extra fields shown as tags. `limit`: max lines (default 100).
 */
export const streamChart: ChartFactory = (el, spec, ctx) => {
  const ix = interactionsOf(ctx);
  const xField = need(spec, "x");
  const yField = need(spec, "y");
  const body = htmlBody(el, spec.height ?? 240, "d3s-stream");

  return {
    update(rows) {
      const lines = rows.slice(-(spec.limit ?? 100)).reverse();
      body.replaceChildren(
        ...lines.map((r) => {
          const at = asDate(r[xField]);
          const level = spec.series ? String(r[spec.series] ?? "") : "";
          const line = h(
            "div",
            "d3s-stream-line",
            h("time", "", at ? timeFormat(at) : String(r[xField] ?? "")),
            ...(level ? [h("span", "d3s-stream-level", level)] : []),
            h("span", "d3s-stream-msg", String(r[yField] ?? "")),
            ...(spec.columns ?? []).map((c) =>
              h("span", "d3s-stream-tag", `${c.label ?? c.field}:${String(r[c.field] ?? "")}`),
            ),
          );
          // Click a line to filter the dashboard by its level.
          if (level) selectOnClick(line, ix, spec.series, level);
          line.style.setProperty("--level", levelColors[level.toLowerCase()] ?? "var(--d3s-grid)");
          return line;
        }),
      );
    },
    setTheme() {},
    destroy: () => body.remove(),
  };
};
