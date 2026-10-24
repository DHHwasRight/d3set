//! `/guide`: how server rendering and hydration fit together.

use crate::pages::{html, views, Ctx, Error, IntoResponse};

pub fn handle(ctx: &mut Ctx) -> Result<impl IntoResponse, Error> {
    html!(ctx, views::guide::Guide {})
}

// Code samples, kept out of the template: rsx reads `{` in markup as an expression.
pub const RENDER: &str = r#"use d3set_ssr::{figure, Agg, Spec, Stream, LIGHT};

let spec = Spec::new("timeseries")
    .x("at").y("latency").series("service")
    .aggregate(Agg::Avg);

// Static: markup only.
let html = d3set_ssr::static_figure(&spec, &rows, &LIGHT, 718.0)?;

// Hydratable: markup plus the spec and rows as JSON, and an optional stream.
let html = figure(&spec, &rows, &LIGHT, 718.0, Some(&Stream::new("/events/ops").key("id")))?;"#;

pub const HYDRATE: &str = r#"import { hydrate } from "d3set";

hydrate(document);"#;

pub const STREAM: &str = r#"data: {"op":"upsert","rows":[{"id":4021,"at":"2026-10-24T16:13:11.000Z","latency":182}]}

data: [{"id":4022,"at":"2026-10-24T16:13:11.500Z","latency":96}]"#;

pub const JT: &str = r#"jt::template! {
    pub fn RequestJson(r: &Request) -> Json {
        "id": r.id,
        "at": iso(r.at),
        "host": &*r.host,
        "latency": r.latency,
    }
}"#;
