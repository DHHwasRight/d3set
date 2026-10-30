//! How the gallery renders a chart: a spec and rows in, HTML out.

use d3set_ssr::{figure, static_figure, Error, Row, Spec, Stream, Theme};

use crate::catalog::Feed;

/// The chart at `width` CSS pixels: the server cannot measure the page, so the caller passes the
/// width, and the SVG scales to its card until the browser redraws it.
///
/// With a stream, the markup also carries the spec and rows as JSON: `hydrate()` makes the chart
/// live and follows the stream. Without one, it is static SVG and HTML.
pub fn render(
    spec: &Spec,
    rows: &[Row],
    theme: &Theme,
    width: f64,
    stream: Option<&Stream>,
) -> Result<String, Error> {
    match stream {
        Some(stream) => figure(spec, rows, theme, width, Some(stream)),
        None => static_figure(spec, rows, theme, width),
    }
}

/// The server-sent events of `feed`. `since` is the time of the newest row the page embeds:
/// the stream sends only what the page does not have. Rows upsert by `id`, so a reconnect that
/// replays rows does not count them twice.
///
/// A static site has no server to stream from: the chart polls the feed's recorded timeline,
/// a JSON file next to the pages.
pub fn stream(feed: Feed, rows: &[Row], max_rows: usize) -> Stream {
    if crate::site::is_static() {
        let url = format!("{}/data/{}.json", crate::site::base(), feed.name());
        return Stream::new(url).max_rows(max_rows).key("id").poll();
    }
    let url = match newest(rows) {
        Some(t) => format!("/events/{}?since={t}", feed.name()),
        None => format!("/events/{}", feed.name()),
    };
    Stream::new(url).max_rows(max_rows).key("id")
}

fn newest(rows: &[Row]) -> Option<f64> {
    rows.iter()
        .filter_map(|r| r.get("at").as_str().and_then(d3set_ssr::time::parse_iso))
        .reduce(f64::max)
}
