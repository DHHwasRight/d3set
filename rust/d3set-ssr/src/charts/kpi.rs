//! `kpi`: a big number (the aggregate of `y`), colored by `thresholds`. With `x`, a trend line per
//! x value and the change of the last x value against the one before. Port of `charts/kpi.ts`,
//! with the single-series part of `toSeriesData` from `charts/xy.ts`.

use crate::agg::{aggregate, extent};
use crate::chart::{Ctx, Error, Rendered};
use crate::format::Format;
use crate::path::Path;
use crate::scale::Linear;
use crate::spec::{Agg, Level, Threshold};
use crate::theme::Theme;
use crate::time::{parse_iso, DAY, HOUR, MINUTE, SECOND, WEEK};
use crate::value::{Row, Value};
use crate::views;

/// The trend sparkline paths. `None` when there are no points (d3 removes the `d` attribute).
pub struct Trend {
    pub area: Option<String>,
    pub line: Option<String>,
}

/// `parseInterval`: `30s`, `5m`, `1h`, ... in milliseconds.
pub fn parse_interval(interval: &str) -> Result<f64, Error> {
    let s = interval.trim();
    let digits = s
        .find(|ch: char| !ch.is_ascii_digit() && ch != '.')
        .unwrap_or(s.len());
    let (num, unit) = s.split_at(digits);
    let num_ok = {
        let mut parts = num.split('.');
        let int = parts.next().unwrap_or("");
        let frac = parts.next();
        !int.is_empty() && parts.next().is_none() && frac.is_none_or(|f| !f.is_empty())
    };
    let unit_ms = match unit {
        "ms" => Some(1.0),
        "s" => Some(SECOND),
        "m" => Some(MINUTE),
        "h" => Some(HOUR),
        "d" => Some(DAY),
        "w" => Some(WEEK),
        _ => None,
    };
    match (num_ok, unit_ms, num.parse::<f64>()) {
        (true, Some(u), Ok(n)) => Ok(n * u),
        _ => Err(Error(format!(
            "d3set: invalid interval '{interval}'. Use a number and a unit: ms, s, m, h, d, w (for example '5m')."
        ))),
    }
}

/// `asDate(v)?.getTime()`.
fn as_date(v: &Value) -> Option<f64> {
    v.as_str().and_then(parse_iso)
}

/// `autoInterval`: the smallest nice interval with at most 60 buckets over the rows' time span.
fn auto_interval(rows: &[Row], x_field: &str) -> f64 {
    const NICE: [f64; 14] = [
        SECOND,
        5.0 * SECOND,
        10.0 * SECOND,
        30.0 * SECOND,
        MINUTE,
        5.0 * MINUTE,
        10.0 * MINUTE,
        30.0 * MINUTE,
        HOUR,
        3.0 * HOUR,
        6.0 * HOUR,
        12.0 * HOUR,
        DAY,
        WEEK,
    ];
    let span =
        extent(rows.iter().filter_map(|r| as_date(r.get(x_field)))).map_or(0.0, |[a, b]| b - a);
    NICE.into_iter().find(|s| span / s <= 60.0).unwrap_or(WEEK)
}

/// One point per x value (sorted), aggregated with `how`: `toSeriesData` with one series.
fn points(c: &Ctx, x_field: &str, y_field: &str, how: Agg) -> Result<Vec<(f64, f64)>, Error> {
    let step = match c.spec.interval.as_deref() {
        None | Some("") => None,
        Some("auto") => Some(auto_interval(c.rows, x_field)),
        Some(i) => Some(parse_interval(i)?),
    };
    let mut cells: Vec<(f64, Vec<f64>)> = Vec::new();
    for r in c.rows {
        let raw = r.get(x_field);
        let x = match as_date(raw) {
            Some(ms) => step.map_or(ms, |s| (ms / s).floor() * s),
            None => raw.num(),
        };
        if x.is_nan() {
            continue;
        }
        match cells.iter_mut().find(|(k, _)| *k == x) {
            Some((_, list)) => list.push(r.num(y_field)),
            None => cells.push((x, vec![r.num(y_field)])),
        }
    }
    cells.sort_by(|a, b| a.0.total_cmp(&b.0));
    Ok(cells
        .into_iter()
        .map(|(x, list)| (x, aggregate(&list, how)))
        .collect())
}

/// `thresholdColor` of the first matching rule, as `valueColor(theme, v, rules, "")`.
pub fn value_color(theme: &Theme, v: f64, rules: &[Threshold]) -> Option<String> {
    rules.iter().find(|t| t.matches(v)).map(|t| {
        t.color.clone().unwrap_or_else(|| {
            match t.level.unwrap_or(Level::Critical) {
                Level::Ok => theme.positive,
                Level::Warning => theme.warning,
                Level::Critical => theme.negative,
            }
            .to_string()
        })
    })
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let y_field = c.need("y")?;
    let how = c.aggregate(Agg::Sum);
    let height = c.height(if c.spec.x.is_some() { 120 } else { 72 });
    let fmt = c.fmt(",.0f");
    let current = aggregate(
        &c.rows.iter().map(|r| r.num(y_field)).collect::<Vec<_>>(),
        how,
    );
    let color = value_color(c.theme, current, &c.spec.thresholds);

    let mut trend = None;
    let mut delta = String::new();
    let mut direction = None;
    if let Some(x_field) = c.spec.x.as_deref() {
        let pts = points(c, x_field, y_field, how)?;
        let dom = |e: Option<[f64; 2]>| e.unwrap_or([f64::NAN, f64::NAN]);
        let x = Linear::new(dom(extent(pts.iter().map(|p| p.0))), [0.0, 100.0]);
        let y = Linear::new(dom(extent(pts.iter().map(|p| p.1))), [28.0, 2.0]);
        let xy: Vec<(f64, f64)> = pts.iter().map(|&(a, b)| (x.map(a), y.map(b))).collect();
        trend = Some(Trend {
            area: area(&xy),
            line: line(&xy),
        });

        if let [.., (_, prev), (_, last)] = pts[..] {
            if prev != 0.0 {
                let change = (last - prev) / prev.abs();
                let up = change >= 0.0;
                delta = format!(
                    "{} {} vs previous",
                    if up { "▲" } else { "▼" },
                    Format::new(".1%").format(change.abs())
                );
                direction = Some(if up { "up" } else { "down" });
            }
        }
    }

    let body = rsx::Template::render_to_string(views::kpi::Kpi {
        value: &fmt.format(current),
        color: color.as_deref(),
        delta: &delta,
        direction,
        trend: trend.as_ref(),
    })?;
    Ok(Rendered {
        body,
        height,
        class: "d3s-kpi",
        style: " display: grid; grid-template-rows: auto auto 1fr;".into(),
        ..Default::default()
    })
}

/// `d3.line()` (linear curve).
fn line(pts: &[(f64, f64)]) -> Option<String> {
    let (first, rest) = pts.split_first()?;
    let mut p = Path::new();
    p.move_to(first.0, first.1);
    for &(x, y) in rest {
        p.line_to(x, y);
    }
    if rest.is_empty() {
        p.close();
    }
    Some(p.finish())
}

/// `d3.area().y0(30)` (linear curve): the top line, then the baseline back.
fn area(pts: &[(f64, f64)]) -> Option<String> {
    let (first, rest) = pts.split_first()?;
    let mut p = Path::new();
    p.move_to(first.0, first.1);
    for &(x, y) in rest {
        p.line_to(x, y);
    }
    for &(x, _) in pts.iter().rev() {
        p.line_to(x, 30.0);
    }
    p.close();
    Some(p.finish())
}
