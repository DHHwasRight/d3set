//! What every page shares: widths, the JavaScript switch, and how an example becomes markup.

use std::cell::Cell;
use std::sync::LazyLock;

use d3set_ssr::payload::SpecJson;
use d3set_ssr::{static_figure, Row, Spec};

use crate::catalog::{Example, Feed};

/// A dashboard spans the wide content column.
pub const DASHBOARD: f64 = 1080.0;
/// Rows embedded per example: enough history to draw, small enough to keep pages light.
pub const EXAMPLE_ROWS: usize = 600;

/// `?js=off`: the page without its script, to show what the server sends.
pub fn js_enabled(query: &str) -> bool {
    !query.split('&').any(|kv| kv == "js=off")
}

thread_local! {
    // Set by `app.rs` around one request: the layout has no request.
    static JS: Cell<bool> = const { Cell::new(true) };
}

/// Whether this request runs JavaScript. `false` for `?js=off`: then the layout sends no script.
pub fn js() -> bool {
    JS.with(Cell::get)
}

/// Run `f` with `on` as this request's JavaScript flag.
pub fn with_js<R>(on: bool, f: impl FnOnce() -> R) -> R {
    let before = JS.with(|c| c.replace(on));
    let out = f();
    JS.with(|c| c.set(before));
    out
}

/// `GALLERY_SWAP_RING=1`: outline every region dp-swap replaces. Read once, at startup.
pub static SWAP_RING: LazyLock<bool> =
    LazyLock::new(|| std::env::var("GALLERY_SWAP_RING").is_ok_and(|v| v == "1"));

/// The body attributes that turn the swap ring on, or none. A static site has no ring.
pub fn swap_ring_attrs() -> Option<(&'static str, &'static str)> {
    (*SWAP_RING && !*STATIC).then_some(("data-swap-ring", ""))
}

/// `GALLERY_STATIC=1`: the pages a static host serves. The streams poll a recorded timeline
/// (`/data/{feed}.json`), the clock is fixed, and nothing links to what needs a server
/// (`?js=off`, the event streams). Read once, at startup.
pub static STATIC: LazyLock<bool> =
    LazyLock::new(|| std::env::var("GALLERY_STATIC").is_ok_and(|v| v == "1"));

/// `GALLERY_BASE=/d3set`: the path the site is served under. Only the URLs inside JSON payloads
/// and the client's configuration carry it: the static export rewrites the HTML attributes.
/// Empty by default; a trailing `/` is dropped.
pub static BASE: LazyLock<String> = LazyLock::new(|| {
    std::env::var("GALLERY_BASE")
        .unwrap_or_default()
        .trim()
        .trim_end_matches('/')
        .to_string()
});

/// Whether these are the pages of a static site.
pub fn is_static() -> bool {
    *STATIC
}

/// The path the site is served under: `""` or `/d3set`.
pub fn base() -> &'static str {
    &BASE
}

pub fn rows(feed: Feed, limit: usize) -> Vec<Row> {
    match feed {
        Feed::Ops => crate::data::ops_rows(limit),
        Feed::Sales => crate::data::sales_rows(limit),
    }
}

pub use crate::snippets::chart::stream;

/// One rendered example: the figure, and its spec as JSON for the code block.
pub struct ExampleView {
    pub title: &'static str,
    pub note: &'static str,
    pub feed: &'static str,
    pub html: String,
    /// The spec as JSON, highlighted.
    pub spec_html: String,
}

pub fn example(e: &Example, live: bool) -> Result<ExampleView, d3set_ssr::Error> {
    let rows = rows(e.feed, EXAMPLE_ROWS);
    let width = crate::styles::page_chart_width();
    let stream = live.then(|| stream(e.feed, &rows, EXAMPLE_ROWS));
    let html = crate::snippets::chart::render(
        &e.spec,
        &rows,
        crate::styles::theme(),
        width,
        stream.as_ref(),
    )?;
    Ok(ExampleView {
        title: e.title,
        note: e.note,
        feed: e.feed.name(),
        html,
        spec_html: crate::highlight::html(
            &crate::pretty::json(&jt::to_string(&SpecJson(&e.spec))),
            "json",
        ),
    })
}

/// A small static chart for the overview grid.
pub fn thumbnail(spec: &Spec, feed: Feed) -> Result<String, d3set_ssr::Error> {
    let mut spec = spec.clone();
    spec.title = None;
    spec.height = Some(if matches!(spec.kind.as_str(), "kpi" | "slo") {
        72
    } else {
        150
    });
    if spec.kind == "table" {
        spec.limit = Some(6);
    }
    static_figure(&spec, &rows(feed, 400), crate::styles::theme(), 300.0)
}

/// Text with `code` spans: backticks become <code>. The input is our own catalog text.
pub fn inline_code(text: &str) -> String {
    let mut out = String::new();
    for (i, part) in text.split('`').enumerate() {
        let escaped = part
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;");
        if i % 2 == 1 {
            out.push_str(&format!("<code>{escaped}</code>"));
        } else {
            out.push_str(&escaped);
        }
    }
    out
}

/// The head script that applies a stored theme choice before the first paint. Without a choice,
/// `color-scheme: light dark` follows the system. The framework galleries carry the same script
/// (`galleries/shared/src/theme.ts`), with the same storage key, so the choice follows the
/// library switch on one origin.
pub const THEME_SCRIPT: &str = r#"try{var t=localStorage.getItem("d3set-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}"#;
