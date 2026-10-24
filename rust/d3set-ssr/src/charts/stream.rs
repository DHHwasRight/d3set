//! `stream`: event or log lines, newest first. Port of `charts/stream.ts`.

use crate::chart::{Ctx, Error, Rendered};
use crate::charts::status::{as_date, time_format};
use crate::charts::table::cell_text;
use crate::charts::toplist::SELECTABLE;
use crate::views;

/// `levelColors[level.toLowerCase()] ?? "var(--d3s-grid)"`.
fn level_var(level: &str) -> &'static str {
    match level.to_lowercase().as_str() {
        "error" | "critical" => "var(--d3s-negative)",
        "warn" | "warning" => "var(--d3s-warning)",
        "info" => "var(--d3s-accent)",
        "ok" => "var(--d3s-positive)",
        "debug" => "var(--d3s-text-muted)",
        _ => "var(--d3s-grid)",
    }
}

/// One line, ready for the template. `level` is empty when there is none.
pub struct Line {
    pub time: String,
    pub level: String,
    pub message: String,
    pub tags: Vec<String>,
    pub style: String,
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let height = c.height(240);
    // `rows.slice(-limit)`: a limit of 0 is `slice(-0)`, every row.
    let limit = c.spec.limit.unwrap_or(100);
    let from = if limit == 0 {
        0
    } else {
        c.rows.len().saturating_sub(limit)
    };
    let lines = c.rows[from..]
        .iter()
        .rev()
        .map(|r| {
            let at = r.get(x_field);
            let level = c
                .spec
                .series
                .as_deref()
                .map(|s| cell_text(r.get(s)))
                .unwrap_or_default();
            let select = if level.is_empty() {
                String::new()
            } else {
                format!("{SELECTABLE} ")
            };
            Line {
                time: as_date(at).map_or_else(|| cell_text(at), time_format),
                style: format!("{select}--level: {};", level_var(&level)),
                level,
                message: cell_text(r.get(y_field)),
                tags: c
                    .spec
                    .columns
                    .iter()
                    .map(|col| {
                        format!(
                            "{}:{}",
                            col.label.as_deref().unwrap_or(&col.field),
                            cell_text(r.get(&col.field))
                        )
                    })
                    .collect(),
            }
        })
        .collect::<Vec<_>>();

    let body = rsx::Template::render_to_string(views::stream::Stream { lines: &lines })?;
    Ok(Rendered {
        body,
        height,
        ..Default::default()
    })
}
