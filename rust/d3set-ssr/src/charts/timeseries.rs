//! `timeseries`: values over time, as lines, areas, or stacked bars. Port of `charts/timeseries.ts`.
//! Defaults: `interval: "auto"`, `aggregate: "sum"`, `display: "line"`.

use super::xy::{
    finish, look_of, margin_of, markers, max, min, to_series_data, y_scale, Parts, XScale,
};
use crate::axis::{xy_axes_with, Edges};
use crate::chart::{Ctx, Error, Rendered, MARGIN};
use crate::color::SeriesColors;
use crate::path::raw;
use crate::spec::Agg;
use crate::views::xy::RectMark;

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let mut spec = c.spec.clone();
    spec.interval.get_or_insert_with(|| "auto".into());
    spec.aggregate.get_or_insert(Agg::Sum);
    let full = Ctx {
        spec: &spec,
        rows: c.rows,
        theme: c.theme,
        width: c.width,
    };
    match c.spec.display.unwrap_or("line") {
        "area" => super::area::render(&full),
        "bars" => bars(&full),
        _ => super::line::render(&full),
    }
}

struct TimeBar<'k> {
    key: &'k str,
    x: f64,
    y0: f64,
    y1: f64,
}

/// `timeBarsChart`: stacked bars per time bucket.
fn bars(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let fmt = c.fmt(".3~s");
    let height = c.height(240);
    let margin = margin_of(c.spec, MARGIN, false);
    let (w, h) = c.inner(height, margin);
    let data = to_series_data(c, x_field, y_field)?;
    let x = XScale::new(&data, w);
    // Bar width: the bucket length, else the smallest gap between x values.
    let step = data
        .step
        .or_else(|| min(data.xs.windows(2).map(|p| p[1] - p[0])))
        .unwrap_or(1.0);
    let bw = data.xs.first().map_or(f64::NAN, |&x0| {
        (x.map(x0 + step) - x.map(x0) - 1.0).max(1.0)
    });

    // d3.stackOffsetDiverging, series-major like `stack.flatMap(layer => layer.map(...))`.
    let mut pos = vec![0.0; data.xs.len()];
    let mut neg = vec![0.0; data.xs.len()];
    let mut bars = Vec::new();
    for k in &data.keys {
        for (i, &xv) in data.xs.iter().enumerate() {
            let v = data.get(i, k).unwrap_or(0.0);
            let (y0, y1) = if v > 0.0 {
                pos[i] += v;
                (pos[i] - v, pos[i])
            } else if v < 0.0 {
                neg[i] += v;
                (neg[i], neg[i] - v)
            } else {
                (0.0, v)
            };
            bars.push(TimeBar {
                key: k,
                x: xv,
                y0,
                y1,
            });
        }
    }
    let lo = min(bars.iter().map(|b| b.y0)).unwrap_or(0.0).min(0.0);
    let hi = max(bars.iter().map(|b| b.y1)).unwrap_or(1.0).max(0.0);
    let hi = if hi == 0.0 || hi.is_nan() { 1.0 } else { hi };
    let y = y_scale([lo, hi], h);
    let colors = SeriesColors::new(c.theme, &data.keys);
    let look = look_of(c.spec, || Edges::Num(Edges::of(&data.xs)));
    let axes = xy_axes_with(
        x.axis(),
        crate::axis::Scale::Linear(&y),
        w,
        h,
        &fmt,
        false,
        &look,
    );

    let rects: Vec<RectMark> = bars
        .iter()
        .map(|b| RectMark {
            x: raw(x.map(b.x)),
            y: raw(y.map(b.y1)),
            width: raw(bw),
            height: raw((y.map(b.y0) - y.map(b.y1)).max(0.0)),
            fill: colors.get(b.key).into(),
        })
        .collect();
    let markers = markers(c, &y, w, &fmt);
    finish(
        c,
        Parts {
            height,
            margin,
            gradients: None,
            axes: &axes,
            paths: &[],
            lines: None,
            rects: &rects,
            markers: &markers,
            keys: &data.keys,
            colors: &colors,
        },
    )
}
