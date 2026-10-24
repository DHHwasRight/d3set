# d3set

Embeddable d3 chart library. You get three things:

1. **Design system**: one `Theme` object (fonts, colors, series palette, spacing, motion). The library maps it to `--d3s-*` CSS variables.
2. **Live data**: charts read rows from server-sent events (SSE). The server pushes rows. The client appends, replaces, or upserts them.
3. **Quick filters**: declare filters in one line each. The library filters in the browser, or it sends the filters to the server as query parameters.

## Quick start

```ts
import { createDashboard, sseSource, multiSelect, range, search, select } from "d3set";
import "d3set/style.css";

createDashboard(document.getElementById("app")!, {
  source: sseSource({ url: "/stream", maxRows: 2000 }),
  filters: [multiSelect("region"), select("product"), range("amount"), search("customer")],
  charts: [
    { type: "kpi", title: "Revenue", y: "amount", format: "$,.0f" },
    { type: "line", title: "Revenue per minute", x: "minute", y: "amount", series: "region", aggregate: "sum" },
    { type: "bar", title: "By product", x: "product", y: "amount", series: "region" },
  ],
});
```

## Demo

```sh
npm install
npm run serve:sse   # terminal 1: fake sales stream on :8787
npm run dev         # terminal 2: demo page
```

## Theme

```ts
import { createTheme, darkTheme } from "d3set";

const brand = createTheme({ color: { accent: "#e11d48", series: ["#e11d48", "#0891b2"] } });
const brandDark = createTheme({ color: { accent: "#fb7185" } }, darkTheme);
dashboard.setTheme(brandDark);
```

Host CSS can override any token: `.my-app .d3s-root { --d3s-radius: 0; }`.
Charts respect `prefers-reduced-motion`.

## Server-sent events protocol

Each event `data` is JSON:

| Payload | Effect |
| --- | --- |
| `[{...}, {...}]` or `{...}` | Merged with the source `mode` (default `append`) |
| `{ "op": "replace", "rows": [...] }` | Replace all rows (use for the first snapshot) |
| `{ "op": "append", "rows": [...] }` | Add rows |
| `{ "op": "upsert", "rows": [...] }` | Replace rows with the same `key`, add the others |

```ts
sseSource({
  url: "/stream",
  mode: "upsert",      // default merge mode
  key: "id",           // required for upsert
  maxRows: 5000,       // sliding window
  events: ["sale"],    // SSE event names, default ["message"]
  throttleMs: 250,     // batch bursts, default: next animation frame
});
```

Updates are batched, so a burst of events gives one redraw.

## Filters

| Builder | UI | Client rule | Server params |
| --- | --- | --- | --- |
| `select(field)` | dropdown | equals | `field=v` |
| `multiSelect(field)` | list | one of | `field=a&field=b` |
| `range(field)` | min / max | `min <= v <= max` | `field_min`, `field_max` |
| `search(field)` | text | contains, case-insensitive | `field=text` |
| `dateRange(field)` | from / to | `from <= v <= to` (whole `to` day) | `field_from`, `field_to` |

Options: `{ id, label, param }`. `select` also takes `options`. Without `options`, the values come from the data.

- `filterMode: "client"` (default): the browser filters the received rows.
- `filterMode: "server"`: a filter change reconnects the stream with new query parameters.

Read or set filters from code: `dashboard.filters.set("region", ["EU"])`.

## Charts

Every spec takes `type`, `title`, `height`, `format` (d3-format), and `span` (dashboard columns, 1 to 3).
Hover shows a tooltip on every chart except `kpi`, `gauge`, and `table`.

| Type | Shows | Reads | Default aggregate |
| --- | --- | --- | --- |
| `line` | Trend over time or a number axis | `x`, `y`, `series` | last value per x |
| `area` | Stacked trend (`stacked: false` overlaps) | `x`, `y`, `series`, `stacked` | last value per x |
| `bar` | Values per category, grouped or `stacked`, `horizontal` | `x`, `y`, `series`, `limit` | `sum` |
| `pie` / `donut` | Share of a total | `x`, `y`, `innerRadius`, `limit` | `sum` |
| `scatter` | One dot per row, bubble with `size` | `x`, `y`, `size`, `series`, `limit` | none |
| `heatmap` | `x` columns × `series` rows, colored by value | `x`, `series`, `y` | `sum` |
| `histogram` | Distribution of one number | `y`, `bins` | count |
| `boxplot` | Quartiles, 1.5 × IQR whiskers, outliers per category | `x`, `y` | none |
| `treemap` | Nested rectangles by size, grouped by `series` | `x`, `y`, `series`, `limit` | `sum` |
| `funnel` | Stage conversion (`options.sort: true` sorts by value) | `x`, `y` | `sum` |
| `gauge` | One value on a `min`–`max` arc | `y`, `min`, `max` | `sum` |
| `kpi` | Big number; with `x`, a trend line and change vs previous x | `y`, `x` | `sum` |
| `table` | Sortable rows; with `x` + `aggregate`, one line per group | `columns`, `x`, `y`, `series`, `limit` | none |

`aggregate` is one of `sum | count | avg | min | max | last`.
`limit` keeps the largest categories and groups the rest into "Other" (for `table`: max lines; for `scatter`: last N rows).

Theme tokens for charts: `color.series` (categories), `color.sequential` (heatmap, gauge), `color.positive` / `color.negative` (KPI change).

Add your own chart type. It gets the same theme, data, and filters:

```ts
import { registerChart } from "d3set";

registerChart("table", (el, spec, { theme }) => ({
  update(rows) { /* draw */ },
  setTheme(t) { /* restyle */ },
  destroy() { el.replaceChildren(); },
}));
```

## Building blocks

`createDashboard` is optional. You can use the parts alone: `sseSource`, `staticSource`, `mergeRows`, `FilterStore`, `applyFilters`, `filtersToParams`, `renderFilterBar`, `getChart`, `applyTheme`.

## Scripts

| Script | Does |
| --- | --- |
| `npm run build` | `dist/d3set.js`, `dist/d3set.css`, type declarations |
| `npm test` | Vitest + jsdom |
| `npm run typecheck` | `tsc --noEmit` |
