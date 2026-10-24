//! `change`: the aggregate of `y` in the last `window` against the window before it, per `series`.
//! Port of `charts/change.ts`. "Now" is the newest `x` timestamp in the data.

use crate::agg::aggregate;
use crate::chart::{Ctx, Error, Rendered};
use crate::charts::toplist::SELECTABLE;
use crate::format::Format;
use crate::spec::Agg;
use crate::time::parse_iso;
use crate::views;

/// `parseInterval`: `30s`, `5m`, `1h`, `1d` in milliseconds, with the TypeScript error text.
pub(crate) fn parse_interval(interval: &str) -> Result<f64, Error> {
    let s = interval.trim();
    let bad = || {
        Error(format!(
            "d3set: invalid interval '{interval}'. Use a number and a unit: ms, s, m, h, d, w (for example '5m')."
        ))
    };
    let split = s
        .find(|ch: char| !(ch.is_ascii_digit() || ch == '.'))
        .ok_or_else(bad)?;
    let (num, unit) = s.split_at(split);
    // `\d+(?:\.\d+)?`
    let valid = match num.split_once('.') {
        None => !num.is_empty(),
        Some((a, b)) => !a.is_empty() && !b.is_empty() && !b.contains('.'),
    };
    let ms = match unit {
        "ms" => 1.0,
        "s" => 1_000.0,
        "m" => 60_000.0,
        "h" => 3_600_000.0,
        "d" => 86_400_000.0,
        "w" => 604_800_000.0,
        _ => return Err(bad()),
    };
    if !valid {
        return Err(bad());
    }
    Ok(num.parse::<f64>().map_err(|_| bad())? * ms)
}

struct Change {
    group: String,
    now: f64,
    before: f64,
    delta: f64,
    ratio: Option<f64>,
}

/// One line, ready for the template.
pub struct ChangeRow {
    pub name: String,
    pub now: String,
    pub delta: String,
    pub delta_style: Option<String>,
    pub title: String,
    pub style: Option<&'static str>,
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let window = c.spec.window.as_deref().unwrap_or("1h");
    let win = parse_interval(window)?;
    let how = c.aggregate(Agg::Sum);
    let fmt = c.fmt(".3~s");
    let pct = Format::new("+.1%");
    let height = c.height(240);

    let times: Vec<f64> = c
        .rows
        .iter()
        .map(|r| {
            r.get(x_field)
                .as_str()
                .and_then(parse_iso)
                .unwrap_or(f64::NAN)
        })
        .collect();
    let end = times
        .iter()
        .copied()
        .filter(|t| t.is_finite())
        .reduce(f64::max);
    let mut changes: Vec<Change> = Vec::new();
    if let Some(end) = end {
        let mut groups: Vec<(String, Vec<f64>, Vec<f64>)> = Vec::new();
        for (r, &t) in c.rows.iter().zip(&times) {
            let now = t > end - win;
            let before = t > end - 2.0 * win;
            if !now && !before {
                continue;
            }
            let key = c.series_of(r, y_field);
            let i = match groups.iter().position(|g| g.0 == key) {
                Some(i) => i,
                None => {
                    groups.push((key, vec![], vec![]));
                    groups.len() - 1
                }
            };
            let g = &mut groups[i];
            if now { &mut g.1 } else { &mut g.2 }.push(r.num(y_field));
        }
        changes = groups
            .into_iter()
            .map(|(group, now, before)| {
                let (now, before) = (aggregate(&now, how), aggregate(&before, how));
                // `before ? … : undefined`: 0 and NaN have no ratio.
                let ratio =
                    (before != 0.0 && !before.is_nan()).then(|| (now - before) / before.abs());
                Change {
                    group,
                    now,
                    before,
                    delta: now - before,
                    ratio,
                }
            })
            .collect();
        let size = |ch: &Change| ch.ratio.unwrap_or(ch.delta).abs();
        changes.sort_by(|a, b| super::toplist::js_order(size(b) - size(a)));
        changes.truncate(c.spec.limit.unwrap_or(20));
    }

    let decrease_is_good = c.spec.decrease_is_good.unwrap_or(false);
    let rows = changes
        .iter()
        .map(|ch| {
            let arrow = if ch.delta == 0.0 {
                "■"
            } else if ch.delta > 0.0 {
                "▲"
            } else {
                "▼"
            };
            let ratio = ch
                .ratio
                .map(|r| format!(" ({})", pct.format(r)))
                .unwrap_or_default();
            let good = if decrease_is_good {
                ch.delta < 0.0
            } else {
                ch.delta > 0.0
            };
            ChangeRow {
                name: ch.group.clone(),
                now: fmt.format(ch.now),
                delta: format!("{arrow} {}{ratio}", fmt.format(ch.delta.abs())),
                delta_style: (ch.delta != 0.0).then(|| {
                    format!(
                        "color: {};",
                        if good {
                            c.theme.positive
                        } else {
                            c.theme.negative
                        }
                    )
                }),
                title: format!(
                    "{}: {} → {}",
                    ch.group,
                    fmt.format(ch.before),
                    fmt.format(ch.now)
                ),
                style: c.spec.series.is_some().then_some(SELECTABLE),
            }
        })
        .collect::<Vec<_>>();

    let body = rsx::Template::render_to_string(views::change::Change {
        series: c.spec.series.as_deref().unwrap_or(""),
        window,
        rows: &rows,
    })?;
    Ok(Rendered {
        body,
        height,
        ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use super::parse_interval;

    #[test]
    fn intervals_like_typescript() {
        assert_eq!(parse_interval("5m").unwrap(), 300_000.0);
        assert_eq!(parse_interval(" 1.5h ").unwrap(), 5_400_000.0);
        assert_eq!(parse_interval("250ms").unwrap(), 250.0);
        assert!(parse_interval("5").is_err());
        assert!(parse_interval("1.h").is_err());
        assert!(parse_interval("m").is_err());
    }
}
