//! `/analytics/{view}`: one view of the billing analytics, under its tabs.

use crate::analytics::{dashboard, find, WIDTH};
use crate::pages::{html, views, Ctx, Error, IntoResponse};

pub fn handle(ctx: &mut Ctx) -> Result<impl IntoResponse, Error> {
    let id = ctx.require("view")?.to_string();
    render(ctx, &id)
}

/// The page of view `id`. `/analytics` shows the first view through this too.
pub fn render(ctx: &mut Ctx, id: &str) -> Result<crate::pages::Response, Error> {
    let (tab, view) = find(id).ok_or_else(|| Error::new(404, "No such view"))?;
    let rows = crate::billing::rows(view.id);
    let mut d = dashboard(view.id, crate::styles::theme()).ok_or_else(|| Error::new(404, "No such view"))?;
    d.width = WIDTH;
    let markup = d.render(&rows).map_err(|e| Error::internal(e.to_string()))?;
    html!(ctx, views::analytics::_view_::AnalyticsPage { tab, view, markup: &markup, rows: rows.len() }).map(IntoResponse::into_response)
}
