//! `/charts/{kind}`: one chart type, its examples rendered on the server and hydrated live.

use crate::catalog::{entry, kinds, Entry};
use crate::pages::{html, views, Ctx, Error, IntoResponse};
use crate::site::{example, js_enabled, ExampleView};

pub struct Neighbor {
    pub href: String,
    pub name: &'static str,
}

pub fn handle(ctx: &mut Ctx) -> Result<impl IntoResponse, Error> {
    let kind = ctx.require("kind")?.to_string();
    let entry: Entry = entry(&kind).ok_or_else(|| Error::new(404, "No such chart"))?;
    let js = js_enabled(&ctx.query);
    let examples = entry
        .examples
        .iter()
        .map(|e| example(e, js))
        .collect::<Result<Vec<ExampleView>, _>>()
        .map_err(|e| Error::internal(e.to_string()))?;
    let all: Vec<&str> = kinds().collect();
    let i = all.iter().position(|k| *k == kind).unwrap_or(0);
    let neighbor = |k: &str| Neighbor { href: format!("/charts/{k}"), name: crate::catalog::entry(k).map_or("", |e| e.name) };
    let prev = (i > 0).then(|| neighbor(all[i - 1]));
    let next = all.get(i + 1).map(|k| neighbor(k));
    html!(ctx, views::charts::_kind_::ChartPage { entry: &entry, examples: &examples, js, path: &ctx.path, prev: prev.as_ref(), next: next.as_ref() })
}
