//! What every page shares: widths, the hydration script, and how an example becomes markup.

use d3set_ssr::payload::SpecJson;
use d3set_ssr::{figure, static_figure, Row, Spec, Stream};

use crate::catalog::{Example, Feed};
use crate::theme::GALLERY;

/// Chart width in the content column: 760px column, minus figure padding (20px) and border (1px) on both sides.
pub const PAGE_CHART: f64 = 718.0;
/// A dashboard spans the wide content column.
pub const DASHBOARD: f64 = 1080.0;
/// Rows embedded per example: enough history to draw, small enough to keep pages light.
pub const EXAMPLE_ROWS: usize = 600;

/// `?js=off`: the page without its script, to show what the server sends.
pub fn js_enabled(query: &str) -> bool {
    !query.split('&').any(|kv| kv == "js=off")
}

/// The module script that hydrates a page. Inline, because the bundle's URL carries its fingerprint.
pub fn boot_script() -> String {
    format!(
        "import {{ hydrate }} from \"{}\";\nwindow.d3set = hydrate(document);\n",
        crate::assets::url("js/d3set.js")
    )
}

pub fn rows(feed: Feed, limit: usize) -> Vec<Row> {
    match feed {
        Feed::Ops => crate::data::ops_rows(limit),
        Feed::Sales => crate::data::sales_rows(limit),
    }
}

/// The time of the newest row, for `?since=`: the stream then sends only what the page does not have.
fn newest(rows: &[Row]) -> Option<f64> {
    rows.iter()
        .filter_map(|r| r.get("at").as_str().and_then(d3set_ssr::time::parse_iso))
        .reduce(f64::max)
}

pub fn stream(feed: Feed, rows: &[Row], max_rows: usize) -> Stream {
    let url = match newest(rows) {
        Some(t) => format!("/events/{}?since={t}", feed.name()),
        None => format!("/events/{}", feed.name()),
    };
    Stream::new(url).max_rows(max_rows).key("id")
}

/// One rendered example: the figure, and its spec as JSON for the code block.
pub struct ExampleView {
    pub title: &'static str,
    pub note: &'static str,
    pub feed: &'static str,
    pub html: String,
    pub spec_json: String,
}

pub fn example(e: &Example, live: bool) -> Result<ExampleView, d3set_ssr::Error> {
    let rows = rows(e.feed, EXAMPLE_ROWS);
    let html = if live {
        figure(
            &e.spec,
            &rows,
            &GALLERY,
            PAGE_CHART,
            Some(&stream(e.feed, &rows, EXAMPLE_ROWS)),
        )?
    } else {
        static_figure(&e.spec, &rows, &GALLERY, PAGE_CHART)?
    };
    Ok(ExampleView {
        title: e.title,
        note: e.note,
        feed: e.feed.name(),
        html,
        spec_json: crate::pretty::json(&jt::to_string(&SpecJson(&e.spec))),
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
    static_figure(&spec, &rows(feed, 400), &GALLERY, 300.0)
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
