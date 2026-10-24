//! `/data/{feed}`: a feed as JSON, written by jt. `?limit=` keeps the newest rows (default 500).

use crate::pages::{Ctx, Error, IntoResponse, Response};

pub fn handle(ctx: &mut Ctx) -> Result<impl IntoResponse, Error> {
    let feed = ctx.require("feed")?.trim_end_matches(".json").to_string();
    let limit = ctx.query.split('&').find_map(|kv| kv.strip_prefix("limit=")).and_then(|v| v.parse().ok()).unwrap_or(500);
    let body = crate::data::feed_json(&feed, limit).ok_or_else(|| Error::new(404, "No such feed"))?;
    Ok(Response::ok(body).with_header("content-type", "application/json"))
}
