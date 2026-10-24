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
npm run serve:sse   # terminal 1: fake sales (/stream) and request logs (/ops) on :8787
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

## Interactions

Charts in a dashboard work together, like in Datadog, Grafana, or Superset.

| Gesture | Where | Effect |
| --- | --- | --- |
| Click a mark | bar, pie, donut, treemap, sunburst, funnel, heatmap column, box plot, scatter dot, top list, host map, status tile, change row, stream line, table | Cross-filter: the other charts show only that value. The clicked chart keeps all its data and dims the rest. |
| Shift-click (or Ctrl/Cmd) | same | Add or remove a value from the selection |
| Click the selected value again | same | Clear the selection |
| Drag | line, area, timeseries, time heatmap, histogram | Range filter on the x field for every chart (zoom) |
| Drag on empty space | scatter | Range filter on x and y |
| Double-click | same charts | Clear that range |
| Hover | time charts | Tooltip, and a rule at the same time on the other time charts |
| Click a legend item | charts with a legend | Show only that series; click again to show all |
| Shift-click a legend item | same | Hide or show that series |

Every active filter shows as a chip under the header, with × to remove it and "Clear all".
A chart click on a field with a declared `select` filter updates that filter and its control.
Other fields get an automatic filter that shows only as a chip.

### Time window and pause

```ts
createDashboard(el, { source, charts, timeField: "at", timeWindow: "15m" });
```

`timeField` adds a window picker (`5m 15m 1h 6h 1d All`, change it with `timeWindows`) and a Pause button.
Pause freezes the data; filters still work on the frozen rows. Choosing a window clears a brush range on the time field.

From code: `dashboard.setTimeWindow("1h")`, `dashboard.setPaused(true)`, `dashboard.clearFilters()`,
`dashboard.filters.set("region", ["EU"])`.

### In custom charts

A chart gets `ctx.interactions` (or nothing when mounted alone):
`toggle(field, value, additive)`, `selection(field)`, `setRange(field, range)`, `hoverTime(t)`, `onHoverTime(fn)`.
The helpers `bindSelect`, `dimOpacity`, `rangeBrush`, and `createLegend` are in `src/charts/util.ts`.

## Server rendering (Rust) and hydration

`rust/d3set-ssr` renders every chart type on the server, with [rsx](https://github.com/DHHwasRight/rsx) templates:
the same scales, ticks, number formats, colors, and markup as the browser library. A page is complete without
JavaScript. `hydrate()` then turns it into live charts in place.

```rust
use d3set_ssr::{figure, static_figure, Agg, Dashboard, Filter, Spec, Stream, LIGHT};

let spec = Spec::new("timeseries").x("at").y("latency").series("service").aggregate(Agg::Avg);
let html = static_figure(&spec, &rows, &LIGHT, 718.0)?;                                  // markup only
let html = figure(&spec, &rows, &LIGHT, 718.0, Some(&Stream::new("/events/ops").key("id")))?; // + payload, live
let html = Dashboard { charts: vec![spec], filters: vec![Filter::select("service")], ..Default::default() }.render(&rows)?;
```

```ts
import { hydrate } from "d3set";
hydrate(document); // every [data-d3s-dashboard] and [data-d3s-chart] with a payload
```

- The payload (written with [jt](https://github.com/DHHwasRight/jt)) carries the spec, the rows, the full theme, and an optional stream.
- The first browser draw has no transition and happens in the same task as the swap, so nothing flashes or moves.
- With `Stream`, rows follow server-sent events; `key("id")` upserts rows, so a replayed catch-up does not count twice.
- Time labels are UTC on both sides.
- `test/ssr-parity.test.ts` renders each case with both renderers and compares axes, legends, marks, and text
  (130 cases). Build the renderer first: `mise exec -- cargo build -p d3set-ssr --example render`.
  To port or change a chart, see `rust/d3set-ssr/PORTING.md`.

### Gallery

`rust/gallery` is a [brocanth](../brocanth) app: every chart type, server-rendered and hydrated, two live dashboards,
and sample feeds typed in Rust and written as JSON by jt (`/data/ops`, `/data/sales`, `/events/{feed}`).

```sh
mise run gallery   # builds the browser bundle into rust/gallery/assets, then serves http://127.0.0.1:3000
```

Append `?js=off` to any page to see what the server sends. Rust 1.98 is pinned in `mise.toml`: rsx proc macros
do not load across compiler versions.

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
Hover shows a tooltip on SVG charts. HTML views (`table`, `toplist`, `status`, `stream`, ...) use native titles.

### Monitoring views (Datadog-style)

| Type | Shows | Reads | Default aggregate |
| --- | --- | --- | --- |
| `timeseries` | Values over time as `display: line \| area \| bars`, auto time buckets, threshold markers | `x`, `y`, `series`, `interval`, `display`, `thresholds` | `sum` |
| `toplist` | Ranked list with bars | `x`, `y`, `limit`, `thresholds`, `options.ascending` | `sum` |
| `change` | Last `window` vs the window before, per `series` | `x`, `y`, `series`, `window`, `decreaseIsGood` | `sum` |
| `timeheatmap` | Value distribution over time (time × value bins, color = count) | `x`, `y`, `interval`, `bins` | count |
| `hostmap` | One hexagon per entity, grouped by `series` | `x`, `y`, `series`, `thresholds` | `last` |
| `status` | Latest check state per entity, worst first | `x`, `y` (level or number + `thresholds`), `series` (time field) | last row |
| `stream` | Event / log stream, newest first | `x` (time), `y` (message), `series` (level), `columns` (tags) | none |
| `slo` | Good share vs target, error budget left | `y`, `objective: { good, target }` | ratio |
| `note` | Static text | `text` | – |

### General charts

| Type | Shows | Reads | Default aggregate |
| --- | --- | --- | --- |
| `line` | Trend over time or a number axis | `x`, `y`, `series`, `interval` | last value per x |
| `area` | Stacked trend (`stacked: false` overlaps) | `x`, `y`, `series`, `stacked`, `interval` | last value per x |
| `bar` | Values per category, grouped or `stacked`, `horizontal` | `x`, `y`, `series`, `limit` | `sum` |
| `pie` / `donut` | Share of a total | `x`, `y`, `innerRadius`, `limit` | `sum` |
| `sunburst` | Two-level share: inner ring `series`, outer ring `x` | `x`, `series`, `y` | `sum` |
| `scatter` | One dot per row, bubble with `size` | `x`, `y`, `size`, `series`, `limit` | none |
| `heatmap` | `x` columns × `series` rows, colored by value | `x`, `series`, `y` | `sum` |
| `histogram` | Distribution of one number | `y`, `bins` | count |
| `boxplot` | Quartiles, 1.5 × IQR whiskers, outliers per category | `x`, `y` | none |
| `treemap` | Nested rectangles by size, grouped by `series` | `x`, `y`, `series`, `limit` | `sum` |
| `funnel` | Stage conversion (`options.sort: true` sorts by value) | `x`, `y` | `sum` |
| `gauge` | One value on a `min`–`max` arc, threshold ticks | `y`, `min`, `max`, `thresholds` | `sum` |
| `kpi` | Big number; with `x`, a trend line and change vs previous x | `y`, `x`, `interval`, `thresholds` | `sum` |
| `table` | Sortable rows; with `x` + `aggregate`, one line per group | `columns`, `x`, `y`, `series`, `limit`, `thresholds` | none |

### Time buckets

`interval: "30s" | "5m" | "1h" | "1d" | "auto"` puts dates into buckets (UTC-aligned) before the aggregate.
`auto` picks a nice interval for about 60 buckets. `timeseries` uses `auto` by default.

### Thresholds (conditional formats)

```ts
const latency = [
  { op: ">", value: 500, level: "critical" },
  { op: ">", value: 250, level: "warning", label: "SLA" },
];
{ type: "timeseries", x: "at", y: "latency", aggregate: "avg", thresholds: latency } // marker lines
{ type: "kpi", y: "latency", aggregate: "avg", thresholds: latency }                 // colored number
```

Rules are tested in order; the first match wins. `level` maps to the theme tokens
`color.positive` (ok), `color.warning`, and `color.negative` (critical). `color` overrides it.

`aggregate` is one of `sum | count | avg | min | max | last`.
`limit` keeps the largest categories and groups the rest into "Other" (for `table`: max lines; for `scatter`: last N rows).

Theme tokens for charts: `color.series` (categories), `color.sequential` (heatmaps, gauge), `color.positive` / `color.warning` / `color.negative` (status, thresholds, changes).

Animation: with `theme.motion: 0` or `prefers-reduced-motion`, charts draw at once with no transition.

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
| `npm run format` | Prettier |
| `npm run build:browser` | `dist-browser/d3set.js`: one ES module with d3 included, for pages without a bundler |
| `mise run gallery` | Build the browser bundle and serve the Rust gallery |
