# Porting a chart to the server renderer

Each chart type in `src/charts/<kind>.ts` (TypeScript) has a Rust port in
`rust/d3set-ssr/src/charts/<kind>.rs` with its markup in `rust/d3set-ssr/src/views/<kind>.rsx`.
The port draws the chart's **first render**: `chart.update(rows)` with motion 0, every legend
item visible, no selection, no hover, no brush. The browser later replaces it during hydration,
so the goal is that nothing moves when that happens.

`charts/bar.rs` + `views/bar.rsx` is the reference port. Read it first.

## Contract

```rust
pub fn render(c: &Ctx) -> Result<Rendered, Error>
```

- `Ctx` (`src/chart.rs`): `spec`, `rows`, `theme`, `width` (CSS px of the chart element).
  Helpers: `c.need("x")` (same error text as TS), `c.height(default)`, `c.fmt(default_spec)`,
  `c.aggregate(default)`, `c.inner(height, margin)`, `c.series_of(row, y_field)`.
- `Rendered`: `body` (markup **inside** the `.d3s-chart` element), `class` (extra classes on
  that element, e.g. `"d3s-kpi"`), `style` (extra inline style after the height), `height`,
  `legend` (`LegendItem { key, color }`, all keys), `force_legend` (pie, donut, sunburst),
  `has_legend` (the TS chart calls `createLegend`, so the legend element exists even with no
  keys), and `plain` (the element is not a `.d3s-chart` and has no fixed height, like `note`).
- The defaults must be the TS defaults: height, format (`.3~s` for most), aggregate, limit, bins.

## Match the DOM the TypeScript chart builds

- SVG charts: wrap in `views::frame::Svg { width, height }`. x/y charts use
  `axis::xy_axes(x, y, w, h, &fmt, value_on_x)` (same as `renderAxes`) and `views::frame::XY`,
  which writes the grid, x axis, y axis, and `<g class="d3s-plot">`.
  Charts with their own groups (pie: one `<g transform>`) reproduce those groups.
- Emit elements in the **same order** as the TS data join (d3 appends in data order).
- Emit the same attributes the TS code sets on marks (`fill`, `stroke`, `opacity`, `fill-opacity`,
  `rx`, ...). The parity test compares x, y, width, height, d, fill, stroke, cx, cy, r, x1, x2, y1,
  y2, opacity, fill-opacity, and `<text>` content.
- Pointer-only elements are not drawn: brush groups, hover rule, tooltip div.
- HTML views (table, toplist, status, ...): same tags, same classes, same text, same order. The
  parity test compares the text and the `tag.class` of every element in the chart element.

## Numbers, colors, formats, time

- Attribute numbers: `path::raw(x)` (JavaScript `String(x)`, no rounding).
- Path data: `path::line(&points)` (monotoneX), `path::area(&[(x, y0, y1)])`,
  `path::arc(inner, outer, start, end, pad_angle)` (no corner radius: the browser draws the
  rounded corners after hydration; the parity test tolerates 0.01, so leave `cornerRadius` out
  only if the TS arc uses it and say so in a comment), and `path::Path` for anything else.
  Coordinates in paths go through `path::n` (3 decimals, d3-shape `digits(3)`).
- Scales: `scale::Linear::new(domain, range).nice(10.0)`, `.ticks(count)`, `scale::Band::new`
  (inner, outer) or `Band::padded`, `scale::Time` (UTC) with `.nice()`. `scale::ticks` is
  `d3.ticks`.
- Number formats: `format::Format::new(spec).format(x)` is `d3.format`. Strings with a minus use
  U+2212 like d3.
- Colors: `color::SeriesColors::new(theme, &all_keys).get(key)` is what `stableColors` gives on a
  first render (keys in name order take the palette in order). `color::sequential(theme, domain, x)`
  is the sequential Lab scale. `color::text_on(fill)`. Threshold colors: see `Threshold::matches`
  and the level colors `theme.positive / warning / negative` (TS `levelColor`).
- Time: `time::parse_iso` is `asDate` (only strings that start with `YYYY-MM-DD`; anything
  else is a number). `time::utc_format`, `time::multi_format`, `time::ticks`. All UTC.
- Grouping: `agg::groups` (first-seen order, like `d3.groups`), `agg::rollup`, `agg::aggregate`,
  `agg::by_name` (natural order), `agg::top_n`, `agg::extent`.

## rsx template notes

- A component is `pub fn Name(params) -> Element { <markup> }` in a `.rsx` file under
  `src/views/`. Pass prepared data (structs with `String` attributes) rather than computing in
  the template.
- `{expr}` is escaped text, `{!expr}` is raw HTML. `attr={expr}` takes a `Display` value.
  `attr?={bool}` is a boolean attribute. An `Option` attribute uses the spread form:
  `{ ...[("transform", opt.as_deref())] }`.
- `if` / `else` / `for` / `match` work in markup. Gotchas: `let x = if a { .. } else { .. };`
  in a template is read as markup, so move it to a helper `fn`; write `a < b` with spaces.
- Self-closing SVG tags render with a closing tag (`<rect ...></rect>`), which is fine inline.

## Workflow and checks

1. Port `src/charts/<kind>.ts` into your module and template. Edit **only** your own files:
   `src/charts/<yours>.rs`, `src/views/<yours>.rsx`, and `test/parity/<group>.cases.ts`.
   `charts/mod.rs` already routes your type to `<kind>::render`. If you need a shared helper,
   put it in your own module.
2. Add parity cases in `test/parity/<group>.cases.ts` (see `bar.cases.ts`): defaults, each
   option the chart reads, an empty `rows: []` case, and a small hand-made case.
   `test/parity/sample.ts` has 120 deterministic rows (`at`, `region`, `product`, `host`,
   `amount`, `latency`, `seats`, `errors`, `level`, `check`, `stage`, `message`).
3. Run, from the repository root:
   ```sh
   mise exec -- cargo build -p d3set-ssr --example render
   npx vitest run test/ssr-parity.test.ts
   mise exec -- cargo test -p d3set-ssr
   mise exec -- cargo clippy -p d3set-ssr --all-targets -- -D warnings
   ```
   `mise exec --` selects Rust 1.98: rsx proc macros do not load with other versions.
4. A parity difference is a bug in the port, not in the test. Do not change the TypeScript
   library or the test harness. If the TS output depends on something the server cannot know
   (layout measurement, `Math.random`), say so in your report.
