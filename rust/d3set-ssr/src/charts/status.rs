//! `status`: one tile per `x` value with its latest status, worst first. Port of `charts/status.ts`.

use crate::chart::{Ctx, Error, Rendered};
use crate::charts::hostmap::collate;
use crate::charts::table::cell_text;
use crate::charts::toplist::{level_color, SELECTABLE};
use crate::time::{iso, parse_iso};
use crate::value::{Row, Value};
use crate::views;

const LEVELS: [&str; 3] = ["ok", "warning", "critical"];

/// `timeFormat`: HH:MM:SS in UTC.
pub(crate) fn time_format(ms: f64) -> String {
    iso(ms)[11..19].to_string()
}

/// `asDate(cell)?.getTime()`: only strings that start with a date.
pub(crate) fn as_date(v: &Value) -> Option<f64> {
    v.as_str().and_then(parse_iso)
}

/// JavaScript `Number(row[field])`: a present `null` and a blank string are 0, a missing field is NaN.
fn js_num(r: &Row, field: &str) -> f64 {
    match r.0.iter().find(|(k, _)| k == field).map(|(_, v)| v) {
        None => f64::NAN,
        Some(Value::Null) => 0.0,
        Some(Value::Str(s)) if s.trim().is_empty() => 0.0,
        Some(v) => v.num(),
    }
}

/// A summary chip, ready for the template.
pub struct Chip {
    pub text: String,
    pub style: String,
}

/// A tile, ready for the template.
pub struct Tile {
    pub name: String,
    pub value: String,
    pub seen: Option<String>,
    pub level: &'static str,
    pub style: String,
    pub title: String,
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let fmt = c.fmt(".3~s");
    let height = c.height(160);

    // Rows arrive in time order: the last row per entity is its current state (first-seen place, like a Map).
    let mut last: Vec<(String, &Row)> = Vec::new();
    for r in c.rows {
        let k = r.text(x_field);
        match last.iter_mut().find(|(n, _)| *n == k) {
            Some(slot) => slot.1 = r,
            None => last.push((k, r)),
        }
    }
    let level_of = |r: &Row| -> &'static str {
        if let Value::Str(s) = r.get(y_field) {
            if let Some(l) = LEVELS.iter().find(|l| **l == s) {
                return l;
            }
        }
        let v = js_num(r, y_field);
        c.spec
            .thresholds
            .iter()
            .find(|t| t.matches(v))
            .and_then(|t| t.level)
            .map_or("ok", |l| l.name())
    };
    let rank = |l: &str| LEVELS.iter().position(|x| *x == l).unwrap_or(0);
    let mut latest: Vec<(String, &Row, &'static str)> =
        last.into_iter().map(|(n, r)| (n, r, level_of(r))).collect();
    latest.sort_by(|a, b| {
        rank(b.2)
            .cmp(&rank(a.2))
            .then_with(|| collate(&a.0, &b.0, true))
    });

    let chips = LEVELS
        .iter()
        .map(|l| Chip {
            text: format!("{} {l}", latest.iter().filter(|d| d.2 == *l).count()),
            style: format!("--dot: {};", level_color(c.theme, l)),
        })
        .collect::<Vec<_>>();
    let tiles = latest
        .iter()
        .map(|(name, r, level)| {
            let v = r.get(y_field);
            Tile {
                name: name.clone(),
                value: match v {
                    Value::Num(n) => fmt.format(*n),
                    _ => cell_text(v),
                },
                seen: c
                    .spec
                    .series
                    .as_deref()
                    .and_then(|s| as_date(r.get(s)))
                    .map(time_format),
                level,
                style: format!("--level: {}; {SELECTABLE}", level_color(c.theme, level)),
                title: format!("{name}: {level}"),
            }
        })
        .collect::<Vec<_>>();

    let body = rsx::Template::render_to_string(views::status::Status {
        chips: &chips,
        tiles: &tiles,
    })?;
    Ok(Rendered {
        body,
        height,
        ..Default::default()
    })
}
