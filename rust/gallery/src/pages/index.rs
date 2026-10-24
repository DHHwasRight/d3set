//! `/`: what the gallery is, and every chart type as a small server-rendered thumbnail.

use crate::catalog::{entry, GROUPS};
use crate::pages::{html, views, Ctx, Error, IntoResponse};

pub struct Thumb {
    pub kind: &'static str,
    pub name: &'static str,
    pub summary: &'static str,
    pub html: String,
}

pub struct Section {
    pub name: &'static str,
    pub thumbs: Vec<Thumb>,
}

pub fn handle(ctx: &mut Ctx) -> Result<impl IntoResponse, Error> {
    let mut sections = Vec::new();
    for group in GROUPS {
        let mut thumbs = Vec::new();
        for kind in group.kinds {
            let Some(e) = entry(kind) else { continue };
            let first = &e.examples[0];
            thumbs.push(Thumb {
                kind: e.kind,
                name: e.name,
                summary: e.summary,
                html: crate::site::thumbnail(&first.spec, first.feed).map_err(|err| Error::internal(err.to_string()))?,
            });
        }
        sections.push(Section { name: group.name, thumbs });
    }
    html!(ctx, views::index::Overview { sections: &sections })
}
