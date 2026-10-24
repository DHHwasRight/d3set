//! `scatter`: one dot per row. `size` makes a bubble chart, `series` colors the dots, and `limit`
//! keeps the last N rows (default 2000). Port of `charts/scatter.ts`.

use super::histogram::{nice, nice_linear};
use super::timeheatmap::as_date;
use crate::agg::{by_name, extent};
use crate::axis::{xy_axes, Scale};
use crate::chart::{Ctx, Error, LegendItem, Rendered, MARGIN};
use crate::color::SeriesColors;
use crate::path::raw;
use crate::scale::{Linear, Time};
use crate::views;

/// One dot, ready for the template.
pub struct ScatterDot {
    pub cx: String,
    pub cy: String,
    pub r: String,
    pub color: &'static str,
}

struct Dot {
    x: f64,
    is_time: bool,
    y: f64,
    size: f64,
    series: String,
}

/// `d3.scaleSqrt().domain([0, max]).range(range)`.
fn sqrt_scale(max: f64, range: [f64; 2], v: f64) -> f64 {
    let t = |x: f64| if x < 0.0 { -(-x).sqrt() } else { x.sqrt() };
    Linear::new([0.0, t(max)], range).map(t(v))
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let height = c.height(240);
    let fmt = c.fmt(".3~s");
    let (w, h) = c.inner(height, MARGIN);

    // `rows.slice(-limit)`: a limit of 0 keeps every row.
    let limit = c.spec.limit.unwrap_or(2000);
    let tail = if limit == 0 || limit >= c.rows.len() {
        c.rows
    } else {
        &c.rows[c.rows.len() - limit..]
    };
    let dots: Vec<Dot> = tail
        .iter()
        .map(|r| {
            let date = as_date(r, x_field);
            Dot {
                x: date.unwrap_or_else(|| r.num(x_field)),
                is_time: date.is_some(),
                y: r.num(y_field),
                size: c.spec.size.as_deref().map_or(1.0, |s| r.num(s)),
                series: c.series_of(r, y_field),
            }
        })
        .filter(|d| !d.x.is_nan() && !d.y.is_nan())
        .collect();

    let is_time = dots.first().is_some_and(|d| d.is_time);
    let x_ext = extent(dots.iter().map(|d| d.x));
    let time;
    let linear;
    let x = if is_time {
        time = Time::new(x_ext.unwrap_or([0.0, 0.0]), [0.0, w]).nice();
        Scale::Time(&time)
    } else {
        linear = nice_linear(x_ext.unwrap_or([0.0, 1.0]), [0.0, w], 10.0);
        Scale::Linear(&linear)
    };
    let x_map = |v: f64| match &x {
        Scale::Time(t) => t.map(v),
        Scale::Linear(l) => l.map(v),
        Scale::Band(_) => 0.0,
    };
    let y = Linear::new(
        nice(extent(dots.iter().map(|d| d.y)).unwrap_or([0.0, 0.0]), 10.0),
        [h, 0.0],
    );
    let max_size = dots
        .iter()
        .map(|d| d.size)
        .filter(|v| !v.is_nan())
        .reduce(f64::max)
        .unwrap_or(1.0);
    let r_range = [2.0, (w.min(h) / 12.0).max(6.0)];
    let radius = |d: &Dot| {
        if c.spec.size.is_some() {
            sqrt_scale(max_size, r_range, d.size)
        } else {
            3.5
        }
    };

    let mut keys: Vec<String> = Vec::new();
    for d in &dots {
        if !keys.contains(&d.series) {
            keys.push(d.series.clone());
        }
    }
    keys.sort_by(|a, b| by_name(a, b));
    let colors = SeriesColors::new(c.theme, &keys);

    let marks: Vec<ScatterDot> = dots
        .iter()
        .map(|d| ScatterDot {
            cx: raw(x_map(d.x)),
            cy: raw(y.map(d.y)),
            r: raw(radius(d)),
            color: colors.get(&d.series),
        })
        .collect();
    let axes = xy_axes(x, Scale::Linear(&y), w, h, &fmt, false);

    let body = rsx::Template::render_to_string(views::scatter::Scatter {
        width: c.width,
        height,
        axes: &axes,
        margin: MARGIN,
        dots: &marks,
        fill_opacity: if c.spec.size.is_some() {
            "0.55"
        } else {
            "0.75"
        },
        // The TS chart always creates its legend; with no keys it is an empty, hidden element.
        // `frame::ChartElement` only writes a legend with items, so the empty one goes here.
    })?;
    Ok(Rendered {
        body,
        height,
        legend: keys
            .iter()
            .map(|k| LegendItem {
                key: k.clone(),
                color: colors.get(k).to_string(),
            })
            .collect(),
        has_legend: true,
        ..Default::default()
    })
}
