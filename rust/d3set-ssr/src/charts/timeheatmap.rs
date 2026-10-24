//! `timeheatmap`: how the values of `y` spread over time. Columns are time buckets of `x`
//! (`interval`, default `auto` for about 40 columns), rows are `bins` value ranges (default 12),
//! and the color is the row count. Port of `charts/timeheatmap.ts`.

use super::histogram::{bin, nice_linear, sequential};
use crate::agg::extent;
use crate::axis::{xy_axes, Scale};
use crate::chart::{Ctx, Error, Rendered, MARGIN};
use crate::path::raw;
use crate::scale::{Linear, Time};
use crate::time::{parse_iso, DAY, HOUR, MINUTE, SECOND, WEEK};
use crate::value::Row;
use crate::views;

/// One cell, ready for the template.
pub struct TimeCell {
    pub x: String,
    pub y: String,
    pub width: String,
    pub height: String,
    pub fill: String,
}

/// `parseInterval` from `charts/util.ts`: `30s`, `5m`, `1h`, `1d` in milliseconds.
pub(crate) fn parse_interval(interval: &str) -> Result<f64, Error> {
    let s = interval.trim();
    let split = s
        .find(|c: char| !c.is_ascii_digit() && c != '.')
        .unwrap_or(s.len());
    let (num, unit) = s.split_at(split);
    let valid_num = match num.split_once('.') {
        None => !num.is_empty(),
        Some((a, b)) => !a.is_empty() && !b.is_empty() && !b.contains('.'),
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
    match (valid_num, unit_ms, num.parse::<f64>()) {
        (true, Some(u), Ok(n)) => Ok(n * u),
        _ => Err(Error(format!(
            "d3set: invalid interval '{interval}'. Use a number and a unit: ms, s, m, h, d, w (for example '5m')."
        ))),
    }
}

/// `asDate` from `charts/util.ts`, as milliseconds.
pub(crate) fn as_date(r: &Row, field: &str) -> Option<f64> {
    r.get(field).as_str().and_then(parse_iso)
}

/// `autoInterval` from `charts/xy.ts`: the smallest nice interval that gives at most `target`
/// buckets over the time span of the rows.
pub(crate) fn auto_interval(rows: &[Row], field: &str, target: f64) -> f64 {
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
    let span = extent(rows.iter().filter_map(|r| as_date(r, field))).map_or(0.0, |[a, b]| b - a);
    NICE.iter()
        .copied()
        .find(|s| span / s <= target)
        .unwrap_or(WEEK)
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let fmt = c.fmt(".3~s");
    let height = c.height(240);
    let (w, h) = c.inner(height, MARGIN);
    let count = c.spec.bins.unwrap_or(12) as f64;

    let step = match c.spec.interval.as_deref() {
        Some(i) if i != "auto" && !i.is_empty() => parse_interval(i)?,
        _ => auto_interval(c.rows, x_field, 40.0),
    };
    let points: Vec<(f64, f64)> = c
        .rows
        .iter()
        .filter_map(|r| Some((as_date(r, x_field)?, r.num(y_field))))
        .filter(|p| p.1.is_finite())
        .collect();
    let y_scale = nice_linear(
        extent(points.iter().map(|p| p.1)).unwrap_or([0.0, 1.0]),
        [h, 0.0],
        count,
    );
    let thresholds = y_scale.ticks(count);
    // `d3.groups` on the bucket start: first-seen order.
    let mut buckets: Vec<(f64, Vec<f64>)> = Vec::new();
    for &(t, v) in &points {
        let b = (t / step).floor() * step;
        match buckets.iter_mut().find(|(k, _)| *k == b) {
            Some((_, list)) => list.push(v),
            None => buckets.push((b, vec![v])),
        }
    }
    // (bucket start, lo, hi, count).
    let mut cells: Vec<(f64, f64, f64, usize)> = Vec::new();
    for (t, list) in &buckets {
        for b in bin(list, y_scale.domain, &thresholds) {
            if b.len > 0 {
                cells.push((*t, b.x0, b.x1, b.len));
            }
        }
    }

    let x = match extent(cells.iter().map(|c| c.0)) {
        Some([a, b]) => Time::new([a, b + step], [0.0, w]),
        None => Time::new([0.0, step], [0.0, w]),
    };
    let y: &Linear = &y_scale;
    let most = cells.iter().map(|c| c.3).max().map_or(1.0, |m| m as f64);

    let mut axes = xy_axes(Scale::Time(&x), Scale::Linear(y), w, h, &fmt, false);
    // The TS chart removes the grid lines.
    axes.grid.ticks.clear();

    let rects: Vec<TimeCell> = cells
        .iter()
        .map(|&(t, lo, hi, n)| TimeCell {
            x: raw(x.map(t)),
            width: raw((x.map(t + step) - x.map(t) - 1.0).max(1.0)),
            y: raw(y.map(hi)),
            height: raw((y.map(lo) - y.map(hi) - 1.0).max(1.0)),
            fill: sequential(c.theme, [0.0, most], n as f64),
        })
        .collect();

    let body = rsx::Template::render_to_string(views::timeheatmap::TimeHeatmap {
        width: c.width,
        height,
        axes: &axes,
        margin: MARGIN,
        cells: &rects,
    })?;
    Ok(Rendered {
        body,
        height,
        ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn intervals_parse_like_ts() {
        assert_eq!(parse_interval("5m").unwrap(), 300_000.0);
        assert_eq!(parse_interval(" 1.5s ").unwrap(), 1_500.0);
        assert_eq!(parse_interval("250ms").unwrap(), 250.0);
        assert!(parse_interval("5").is_err());
        assert!(parse_interval("m").is_err());
        assert!(parse_interval("1.m").is_err());
    }
}
