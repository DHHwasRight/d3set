//! `/guide`: the code that draws this gallery's charts, read from the files that run it.
//!
//! The spec section is common to every gallery. The `data-snippet` part is this gallery's own:
//! the framework galleries (galleries/*) put their own code there.

use d3set_ssr::payload::SpecJson;

use crate::highlight::html as highlight;
use crate::pages::{html, views, Ctx, Error, IntoResponse};
use crate::snippets::{lang_name, Snippet, CHART, FEEDS, HYDRATE};

/// The chart the guide takes as its example.
const KIND: &str = "bar";

/// A source file as the page shows it: its path, its grammar, and the highlighted code.
pub struct Code {
    pub path: &'static str,
    pub lang: &'static str,
    pub html: String,
}

impl Code {
    fn of(s: &Snippet) -> Self {
        Self { path: s.path, lang: lang_name(s.lang), html: highlight(s.code, s.lang) }
    }
}

pub fn handle(ctx: &mut Ctx) -> Result<impl IntoResponse, Error> {
    let entry = crate::catalog::entry(KIND).ok_or_else(|| Error::internal("no bar chart in the catalog"))?;
    let spec = &entry.examples[0].spec;
    let spec = highlight(&crate::pretty::json(&jt::to_string(&SpecJson(spec))), "json");
    let template = Code {
        path: "rust/d3set-ssr/src/views/bar.rsx",
        lang: "rsx",
        html: highlight(d3set_ssr::sources::view(KIND).unwrap_or_default(), "rsx"),
    };
    html!(ctx, views::guide::Guide {
        spec: &spec,
        chart: &Code::of(&CHART),
        template: &template,
        hydrate: &Code::of(&HYDRATE),
        stream: &highlight(STREAM, "text"),
        feeds: &Code::of(&FEEDS),
    })
}

/// Two frames of a feed, as the stream sends them: an envelope, then bare rows.
// Kept out of the template: rsx reads `{` in markup as an expression.
pub const STREAM: &str = r#"data: {"op":"upsert","rows":[{"id":4021,"at":"2026-10-24T16:13:11.000Z","latency":182}]}

data: [{"id":4022,"at":"2026-10-24T16:13:11.500Z","latency":96}]"#;
