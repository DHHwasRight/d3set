//! `/data/{feed}`: a feed as JSON, written by jt. `?limit=` keeps the newest rows (default 500).
//!
//! `/data/{feed}.json` is the recorded timeline instead: the frames the live feed sends after the
//! history ends. A static site serves that file, and its charts poll it.

use crate::pages::{Ctx, Error, IntoResponse, Response};

pub fn handle(ctx: &mut Ctx) -> Result<impl IntoResponse, Error> {
    let name = ctx.require("feed")?.to_string();
    let body = match name.strip_suffix(".json") {
        Some(feed) => crate::data::timeline_json(feed),
        None => {
            let limit = ctx.query.split('&').find_map(|kv| kv.strip_prefix("limit=")).and_then(|v| v.parse().ok()).unwrap_or(500);
            crate::data::feed_json(&name, limit)
        }
    };
    let body = body.ok_or_else(|| Error::new(404, "No such feed"))?;
    Ok(Response::ok(body).with_header("content-type", "application/json"))
}
