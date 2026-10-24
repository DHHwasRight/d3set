import * as d3 from "d3";
import type { Row } from "../data/types";
import type { ChartFactory, ColumnSpec } from "./types";
import { aggregate, interactionsOf, matchThreshold, selectOnClick, thresholdColor } from "./util";

type Sort = { field: string; dir: "ascending" | "descending" } | undefined;

/**
 * A sortable table.
 * - Raw mode (default): one line per row. Pick fields with `columns`.
 * - Group mode (`x` and `aggregate` set): one line per `x` value (and `series` value), with the aggregate of `y`.
 * Column `thresholds` (or spec `thresholds` for the group metric) color numbers.
 * Click a group line (or a text cell in raw mode) to cross-filter the dashboard.
 * `limit` caps the number of lines (default 100). Click a header to sort.
 */
export const tableChart: ChartFactory = (el, spec, ctx) => {
  let theme = ctx.theme;
  const ix = interactionsOf(ctx);
  el.classList.add("d3s-chart");
  el.style.height = `${spec.height ?? 240}px`;
  const wrap = document.createElement("div");
  wrap.className = "d3s-table-wrap";
  const table = document.createElement("table");
  table.className = "d3s-table";
  const thead = table.createTHead();
  const tbody = table.createTBody();
  wrap.append(table);
  el.append(wrap);

  const limit = spec.limit ?? 100;
  const grouped = Boolean(spec.x && spec.aggregate);
  let rows: Row[] = [];
  let sort: Sort;

  function shape(input: Row[]): { columns: ColumnSpec[]; lines: Row[] } {
    if (grouped) {
      const x = spec.x!;
      const y = spec.y ?? x;
      const keys = [x, ...(spec.series ? [spec.series] : [])];
      const groups = d3.rollups(
        input,
        (v) =>
          aggregate(
            v.map((r) => Number(r[y])),
            spec.aggregate!,
          ),
        (r) => keys.map((k) => String(r[k])).join("\u0000"),
      );
      const metric = `${spec.aggregate}(${y})`;
      const lines = groups.map(([key, value]) => {
        const parts = key.split("\u0000");
        return { ...Object.fromEntries(keys.map((k, i) => [k, parts[i]])), [metric]: value } as Row;
      });
      const columns = spec.columns ?? [
        ...keys.map((field) => ({ field })),
        { field: metric, format: spec.format, thresholds: spec.thresholds },
      ];
      return { columns, lines };
    }
    const first = input[0] ?? {};
    return { columns: spec.columns ?? Object.keys(first).map((field) => ({ field })), lines: input };
  }

  const compare = (a: unknown, b: unknown) =>
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true });

  function render() {
    const { columns, lines } = shape(rows);
    let view = lines;
    if (sort) {
      const { field, dir } = sort;
      view = lines.slice().sort((a, b) => (dir === "ascending" ? 1 : -1) * compare(a[field], b[field]));
    }
    view = view.slice(0, limit);

    const formatters = columns.map((c) => (c.format ? d3.format(c.format) : undefined));
    const isNumeric = columns.map((c) => lines.some((r) => typeof r[c.field] === "number"));

    const headRow = document.createElement("tr");
    columns.forEach((c, i) => {
      const th = document.createElement("th");
      th.textContent = c.label ?? c.field;
      th.style.textAlign = c.align ?? (isNumeric[i] ? "right" : "left");
      th.setAttribute("aria-sort", sort?.field === c.field ? sort.dir : "none");
      th.addEventListener("click", () => {
        sort =
          sort?.field !== c.field
            ? { field: c.field, dir: isNumeric[i] ? "descending" : "ascending" }
            : { field: c.field, dir: sort.dir === "ascending" ? "descending" : "ascending" };
        render();
      });
      headRow.append(th);
    });
    thead.replaceChildren(headRow);

    tbody.replaceChildren(
      ...view.map((r) => {
        const tr = document.createElement("tr");
        columns.forEach((c, i) => {
          const td = document.createElement("td");
          const v = r[c.field];
          const f = formatters[i];
          td.textContent = v === undefined || v === null ? "" : f && typeof v === "number" ? f(v) : String(v);
          td.style.textAlign = c.align ?? (isNumeric[i] ? "right" : "left");
          if (c.thresholds && typeof v === "number") {
            const t = matchThreshold(v, c.thresholds);
            if (t) {
              td.style.color = thresholdColor(theme, t);
              td.style.fontWeight = "600";
            }
          }
          // Raw mode: click a text cell to filter the dashboard by that value.
          if (!grouped && !isNumeric[i] && v !== undefined && v !== null) {
            td.classList.add("d3s-cell-link");
            selectOnClick(td, ix, c.field, String(v));
          }
          tr.append(td);
        });
        // Group mode: click a line to filter the dashboard by its group.
        if (grouped) selectOnClick(tr, ix, spec.x, String(r[spec.x!]));
        return tr;
      }),
    );
  }

  return {
    update(next) {
      rows = next;
      render();
    },
    setTheme(next) {
      theme = next;
      render();
    },
    destroy: () => wrap.remove(),
  };
};
