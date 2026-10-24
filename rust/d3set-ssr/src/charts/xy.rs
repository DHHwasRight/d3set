//! Shared x/y helpers for line, area, and timeseries: a port of `charts/xy.ts`
//! (`toSeriesData`, `autoInterval`, `xScale`) and of `renderMarkers` in `charts/util.ts`.

use crate::agg::{aggregate, by_name};
use crate::axis::Scale;
use crate::chart::{Ctx, Error};
use crate::format::Format;
use crate::path::raw;
use crate::scale::{Linear, Time};
use crate::spec::{Agg, Level};
use crate::theme::Theme;
use crate::time::{parse_iso, DAY, HOUR, MINUTE, SECOND, WEEK};
use crate::value::Row;

/// `parseInterval`: `30s`, `5m`, `1h`, `1d` in milliseconds.
pub fn parse_interval(interval: &str) -> Result<f64, Error> {
    let s = interval.trim();
    let invalid = || {
        Error(format!(
            "d3set: invalid interval '{interval}'. Use a number and a unit: ms, s, m, h, d, w (for example '5m')."
        ))
    };
    let split = s
        .find(|c: char| !c.is_ascii_digit() && c != '.')
        .ok_or_else(invalid)?;
    let (num, unit) = s.split_at(split);
    // The number is `\d+(\.\d+)?`.
    let valid_num = {
        let mut parts = num.splitn(2, '.');
        let int = parts.next().unwrap_or_default();
        let frac = parts.next();
        !int.is_empty()
            && int.bytes().all(|b| b.is_ascii_digit())
            && frac.is_none_or(|f| !f.is_empty() && f.bytes().all(|b| b.is_ascii_digit()))
    };
    let unit_ms = match unit {
        "ms" => 1.0,
        "s" => SECOND,
        "m" => MINUTE,
        "h" => HOUR,
        "d" => DAY,
        "w" => WEEK,
        _ => return Err(invalid()),
    };
    if !valid_num {
        return Err(invalid());
    }
    Ok(num.parse::<f64>().map_err(|_| invalid())? * unit_ms)
}

const NICE_STEPS: [f64; 14] = [
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

fn as_date(r: &Row, field: &str) -> Option<f64> {
    r.get(field).as_str().and_then(parse_iso)
}

/// `autoInterval`: the smallest nice interval that gives at most 60 buckets over the rows.
pub fn auto_interval(rows: &[Row], x_field: &str) -> f64 {
    let ext = crate::agg::extent(rows.iter().filter_map(|r| as_date(r, x_field)));
    let span = ext.map_or(0.0, |[a, b]| b - a);
    NICE_STEPS
        .iter()
        .copied()
        .find(|s| span / s <= 60.0)
        .unwrap_or(WEEK)
}

/// Rows as series over a shared x domain, like `SeriesData`.
pub struct SeriesData {
    /// Series keys in name order.
    pub keys: Vec<String>,
    /// Sorted distinct x values (ms for times).
    pub xs: Vec<f64>,
    pub is_time: bool,
    /// One map per x in `xs`: series key to value.
    pub table: Vec<Vec<(String, f64)>>,
    /// Bucket length in ms, for time data with an interval.
    pub step: Option<f64>,
}

impl SeriesData {
    /// The value of series `k` at the `i`-th x.
    pub fn get(&self, i: usize, k: &str) -> Option<f64> {
        self.table[i].iter().find(|(key, _)| key == k).map(|e| e.1)
    }
}

/// The values of each series at one x, in first-seen order.
type Cell = Vec<(String, Vec<f64>)>;

/// `toSeriesData(rows, spec, x, y)`.
pub fn to_series_data(c: &Ctx, x_field: &str, y_field: &str) -> Result<SeriesData, Error> {
    let how = c.aggregate(Agg::Last);
    let step = match c.spec.interval.as_deref() {
        None | Some("") => None,
        Some("auto") => Some(auto_interval(c.rows, x_field)),
        Some(i) => Some(parse_interval(i)?),
    };
    let mut keys: Vec<String> = Vec::new();
    let mut is_time = false;
    // x, then series key with its values, in first-seen order.
    let mut cells: Vec<(f64, Cell)> = Vec::new();
    for r in c.rows {
        let n = match as_date(r, x_field) {
            Some(t) => {
                is_time = true;
                match step {
                    Some(s) => (t / s).floor() * s,
                    None => t,
                }
            }
            None => r.num(x_field),
        };
        if n.is_nan() {
            continue;
        }
        let k = c.series_of(r, y_field);
        if !keys.contains(&k) {
            keys.push(k.clone());
        }
        let pos = match cells.iter().position(|(x, _)| *x == n) {
            Some(p) => p,
            None => {
                cells.push((n, Vec::new()));
                cells.len() - 1
            }
        };
        let row = &mut cells[pos].1;
        let v = r.num(y_field);
        match row.iter_mut().find(|(key, _)| *key == k) {
            Some((_, list)) => list.push(v),
            None => row.push((k, vec![v])),
        }
    }
    cells.sort_by(|a, b| a.0.total_cmp(&b.0));
    keys.sort_by(|a, b| by_name(a, b));
    let xs = cells.iter().map(|(x, _)| *x).collect();
    let table = cells
        .into_iter()
        .map(|(_, row)| {
            row.into_iter()
                .map(|(k, list)| (k, aggregate(&list, how)))
                .collect()
        })
        .collect();
    Ok(SeriesData {
        keys,
        xs,
        is_time,
        table,
        step: if is_time { step } else { None },
    })
}

/// `xScale`: time (UTC) or linear over the data. With buckets, the domain ends at the end of the last one.
pub enum XScale {
    Linear(Linear),
    Time(Time),
}

impl XScale {
    pub fn new(data: &SeriesData, w: f64) -> Self {
        let domain = match crate::agg::extent(data.xs.iter().copied()) {
            None => [0.0, 1.0],
            Some([a, b]) => [a, b + data.step.unwrap_or(0.0)],
        };
        if data.is_time {
            XScale::Time(Time::new(domain, [0.0, w]))
        } else {
            XScale::Linear(Linear::new(domain, [0.0, w]))
        }
    }

    pub fn map(&self, x: f64) -> f64 {
        match self {
            XScale::Linear(s) => s.map(x),
            XScale::Time(s) => s.map(x),
        }
    }

    pub fn axis(&self) -> Scale<'_> {
        match self {
            XScale::Linear(s) => Scale::Linear(s),
            XScale::Time(s) => Scale::Time(s),
        }
    }
}

/// `d3.scaleLinear().domain(domain).nice().range([h, 0])`.
pub fn y_scale(domain: [f64; 2], h: f64) -> Linear {
    Linear::new(domain, [h, 0.0]).nice(10.0)
}

/// One threshold marker line, ready for the template.
pub struct Marker {
    pub transform: String,
    pub x2: String,
    pub color: String,
    pub label: String,
}

/// `renderMarkers`: dashed lines at the thresholds inside the y domain.
pub fn markers(c: &Ctx, y: &Linear, w: f64, fmt: &Format) -> Vec<Marker> {
    let [lo, hi] = y.domain;
    c.spec
        .thresholds
        .iter()
        .filter(|t| t.value >= lo && t.value <= hi)
        .map(|t| Marker {
            transform: format!("translate(0,{})", raw(y.map(t.value))),
            x2: raw(w),
            color: threshold_color(c.theme, t.color.as_deref(), t.level),
            label: t
                .label
                .clone()
                .unwrap_or_else(|| format!("{} {}", t.op, fmt.format(t.value))),
        })
        .collect()
}

fn threshold_color(theme: &Theme, color: Option<&str>, level: Option<Level>) -> String {
    match (color, level.unwrap_or(Level::Critical)) {
        (Some(c), _) => c.to_string(),
        (None, Level::Ok) => theme.positive.to_string(),
        (None, Level::Warning) => theme.warning.to_string(),
        (None, Level::Critical) => theme.negative.to_string(),
    }
}

/// The rendered chart: frame, axes, marks, markers, and a legend of every series key.
pub struct Parts<'a> {
    pub height: f64,
    pub axes: &'a crate::axis::XYAxes,
    pub paths: &'a [crate::views::xy::PathMark],
    pub rects: &'a [crate::views::xy::RectMark],
    pub markers: &'a [Marker],
    pub keys: &'a [String],
    pub colors: &'a crate::color::SeriesColors<'a>,
}

pub fn finish(c: &Ctx, p: Parts<'_>) -> Result<crate::chart::Rendered, Error> {
    let body = rsx::Template::render_to_string(crate::views::xy::XYChart {
        width: c.width,
        height: p.height,
        axes: p.axes,
        margin: crate::chart::MARGIN,
        paths: p.paths,
        rects: p.rects,
        markers: p.markers,
    })?;
    Ok(crate::chart::Rendered {
        body,
        height: p.height,
        legend: p
            .keys
            .iter()
            .map(|k| crate::chart::LegendItem {
                key: k.clone(),
                color: p.colors.get(k).to_string(),
            })
            .collect(),
        has_legend: true,
        ..Default::default()
    })
}

/// `d3.min` / `d3.max` over values, ignoring NaN.
pub fn min(values: impl IntoIterator<Item = f64>) -> Option<f64> {
    values.into_iter().filter(|v| !v.is_nan()).reduce(f64::min)
}

pub fn max(values: impl IntoIterator<Item = f64>) -> Option<f64> {
    values.into_iter().filter(|v| !v.is_nan()).reduce(f64::max)
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
        assert!(parse_interval("5x").is_err());
    }
}
