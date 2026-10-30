//! `/analytics`: the first view, Active subscriptions.

use crate::pages::{Ctx, Error, IntoResponse};

pub fn handle(ctx: &mut Ctx) -> Result<impl IntoResponse, Error> {
    super::_view_::render(ctx, "subscriptions-active")
}
