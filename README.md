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

const brand = createTheme({
  color: { accent: "#e11d48", series: ["#e11d48", "#0891b2"] },
  dark: { accent: "#fb7185", series: ["#fb7185", "#22d3ee"] },
});
dashboard.setTheme(brand);
```

### Light and dark

Every color a chart draws is a CSS var (`fill: var(--d3s-series-0)`). With `theme.dark`, each var
holds `light-dark(<light>, <dark>)`, so the page's CSS `color-scheme` picks the color:

```css
:root { color-scheme: light dark; }                     /* follow the system */
:root[data-theme="dark"] { color-scheme: dark; }        /* or force one */
```

- A switch changes `color-scheme`. The charts change color with no redraw, and the server-rendered
  markup is right before any script runs.
- `lightTheme` has `dark: darkTheme.color`. `darkTheme` has no `dark`: it is always dark.
- `theme.dark` is partial: a color it leaves out is the same in both modes. `createTheme` merges it.
- The vars: `--d3s-bg`, `--d3s-surface`, `--d3s-text`, `--d3s-text-muted`, `--d3s-grid`,
  `--d3s-axis`, `--d3s-accent`, `--d3s-positive`, `--d3s-warning`, `--d3s-negative`,
  `--d3s-series-<i>`, `--d3s-named-<hash>` (one per `color.named` entry), `--d3s-seq-0` and
  `--d3s-seq-1`. A continuous color (heatmap, gauge) is
  `color-mix(in oklab, var(--d3s-seq-1) <p>%, var(--d3s-seq-0))`.
- The Rust renderer writes the same vars: `Theme { dark: Some(&colors), .. }`, with
  `d3set_ssr::Colors` (`LIGHT` takes `DARK_COLORS`).

Host CSS can override any token: `.my-app .d3s-root { --d3s-radius: 0; }`.
Charts respect `prefers-reduced-motion`.

## Interactions

Charts in a dashboard work together, like in Datadog or Grafana.

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

### Galleries

The same gallery exists four times, once per way to use d3set:

| Gallery | Code | Address | Run |
| --- | --- | --- | --- |
| Vanilla | `galleries/vanilla` | http://localhost:3300 | `npm run dev -w galleries/vanilla` |
| Rust | `rust/gallery` | http://localhost:3000 | `mise run gallery` |
| React | `galleries/react` | http://localhost:3310 | `npm run dev -w galleries/react` |
| Next.js | `galleries/next` | http://localhost:3320 | `npm run dev -w galleries/next` |

The Rust gallery is a [brocanth](https://github.com/DHHwasRight/brocanth) app: every chart type, server-rendered and hydrated, two live
dashboards, an analytics page, and sample feeds typed in Rust and written as JSON by jt (`/data/ops`,
`/data/sales`, `/events/{feed}`). The Rust gallery is the reference: the framework galleries draw the
pages it exports (`galleries/shared/fixtures`, not in git). Each gallery shows its own code: the snippets
on its pages are the files in its `snippets/` folder.

#### Launch the galleries

1. Install the toolchain and the packages, once:

   ```sh
   mise install     # Rust 1.98 and Node 26, from mise.toml
   npm ci
   ```

2. Start the Rust gallery. `mise run gallery` builds the browser bundle and serves
   http://localhost:3000 with live feeds.
3. Before the first start of a framework gallery, and after each change to the Rust gallery, export the
   pages it draws:

   ```sh
   node scripts/pages/build.mjs --only fixtures
   ```

   This builds the Rust gallery, runs it with a fixed clock on port 3140, and writes the fixtures.
4. Start any framework gallery with its `Run` command above. Vite and Next.js reload on change.

To see all four at once as they are published, build the GitHub Pages site and serve it:

```sh
npm run pages:serve   # http://localhost:4000/d3set/
```

The switch at the top right opens the same page in the other galleries. The links use the addresses above.
To change them, set `GALLERY_LIBRARIES`, for example
`GALLERY_LIBRARIES=vanilla=https://vanilla.example.com,rsx=https://rust.example.com,react=...,next=...`.
The Rust gallery reads it when it starts. The framework galleries read it when they build.

Settings of the Rust gallery, read when it starts:

| Variable | Does |
| --- | --- |
| `GALLERY_ADDR` | Address to listen on. Default `127.0.0.1:3000` |
| `GALLERY_NOW` | Fixed clock, for example `2026-10-01T00:00:00Z`: the history ends there and the feeds stop |
| `GALLERY_STATIC=1` | Static pages: the charts poll `data/<feed>.json`, dp-swap reads `partials/`. For `gallery export` |
| `GALLERY_BASE` | Path prefix of a static site, for example `/d3set` |
| `GALLERY_LIBRARIES` | Addresses of the four galleries for the library switch |
| `GALLERY_SWAP_RING=1` | Outline each region a partial navigation replaces |

Code snippets in the Rust gallery are highlighted on the server with [giallo](https://github.com/getzola/giallo)
(TextMate grammars and VS Code themes): Rust, JSON, and TypeScript from its built-in set, rsx and jt from
`rsx::grammar` and `jt::grammar`, the same grammars their VS Code extensions ship.

### GitHub Pages

The four galleries also build as one static site, for https://dhhwasright.github.io/d3set/:
the Rust gallery at the root, the others under `vanilla/`, `react/` and `next/`.
`.github/workflows/pages.yml` builds, tests and deploys it on every push to `main`.

```sh
npm run pages:build   # dist-pages/, for the GitHub Pages address
npm run pages:serve   # http://localhost:4000/d3set/, rebuilds on change and reloads the browser
```

`pages:build` (`scripts/pages/build.mjs`) runs these tasks. A task starts when the tasks it needs are
done, so independent ones run in parallel:

| Task | Does | Needs |
| --- | --- | --- |
| `cargo` | Builds the gallery binary | |
| `fixtures` | Exports the Rust gallery's pages for the framework galleries | `cargo` |
| `rsx` | Writes the Rust gallery as files with `gallery export` | `cargo` |
| `lib` | Builds d3set, `@d3set/react` and `@d3set/next`, which Next.js loads | |
| `vanilla`, `react` | Build the gallery under its path prefix | `fixtures` |
| `next` | Same, with `output: "export"` | `fixtures`, `lib` |

The console shows one line per task. Each task's output is in `target/pages-logs/<task>.log`, and the
console prints the end of it when the task fails. `--only rsx,next` runs some tasks: a task they need runs
too when its output is missing.

`pages:serve` watches `src/`, `packages/`, `rust/` and `galleries/`, and runs only the tasks a change needs:
a framework gallery's file rebuilds that gallery, a Rust file rebuilds the Rust site and the fixtures,
and the framework galleries only when the fixtures changed. The open pages reload when the build ends.

- The Rust gallery runs with `GALLERY_STATIC=1` and `GALLERY_BASE=/d3set`, and `gallery export`
  writes it with [brocanth-static](https://github.com/DHHwasRight/brocanth/blob/main/docs/static-export.md):
  each page as a document, one partial per layout depth under `partials/<depth>/`, and the feeds as
  `data/<feed>.json` timelines.
- Partial navigation reads those files: dp-swap gets `partialDir` and `base` from
  `<meta name="dp-config">`. A static host cannot read the `DP-Partial` header.
- The charts poll the timelines (`transport: "poll"`, see [Pull from a static file](#pull-from-a-static-file))
  instead of following server-sent events.
- `PAGES_URL` builds for another address. `pages:serve` builds for its own address, so the library
  switch stays on the local server; `PORT` and `PAGES_OUT` change its port and directory.
- `D3SET_PAGES=1 npm run e2e` also tests the built site; `D3SET_PAGES=only` tests only the built site.

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

## Pull from a static file

A static host (GitHub Pages, a bucket) cannot push events. `pollSource` fetches a JSON file
instead. The file is a **timeline**: one message per frame, in the SSE payload format above.

```json
{ "interval": 2000, "frames": [[{ "id": 1, "value": 3 }], { "op": "upsert", "rows": [{ "id": 1, "value": 5 }] }] }
```

```ts
pollSource({ url: "data/sales.json", mode: "upsert", key: "id", maxRows: 500 });
```

- The source applies one frame per `interval`, so the charts animate like with SSE. The file's
  `interval` wins over the option (default 2000 ms).
- Playback starts on the first frame when the page opens: the frames continue the rows the page
  was drawn with, so the time axis has no gap.
- At the end of each loop the source fetches the file again with `If-None-Match`. A 304 keeps the
  frames. A new deploy of the file brings new frames.
- `shift` makes each loop new data. Without it, the second loop sends the same rows again, and an
  upsert by key changes nothing. With
  `"shift": { "time": "at", "key": "id" }`, pass `j` (0 is the first pass since the page opened)
  moves each `time` field forward by `j` loops (`interval × frames.length` ms). A number moves
  as milliseconds, and an ISO string keeps its format. The `key` becomes unique to the pass: a
  number moves past every key in the file, and a string gets `#j`. `time` can be a list of
  fields.
- A file without `frames` is one message. The source fetches it every `interval` and applies it
  when it changes.
- A relative `url` resolves against `document.baseURI`.

A server-rendered payload selects it with `stream: { url, transport: "poll", interval }`
(`Stream::new(url).poll().interval(ms)` in Rust). In React, `useStreamSource(stream)` picks the
transport from the same option.

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
| `npm run e2e` | Playwright against the built Rust gallery (installed Chrome): layout shift while loading, hydration parity, partial navigation, the library switch |
| `D3SET_CONFORMITY=1 npm run e2e` | Also check that the vanilla, React and Next.js galleries draw the same pages as the Rust gallery (`D3SET_GALLERIES=vanilla,react` limits the run) |
| `npm run pages:build` | The GitHub Pages site in `dist-pages/` (all four galleries) |
| `npm run pages:serve` | Serve that site at http://localhost:4000/d3set/, rebuild on change, reload the browser |
| `D3SET_PAGES=1 npm run e2e` | Also test the built GitHub Pages site |
| `npm run build:browser` | `dist-browser/d3set.js`: one ES module with d3 included, for pages without a bundler |
| `mise run gallery` | Build the browser bundle and serve the Rust gallery |
