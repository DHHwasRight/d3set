//! `area`: filled areas over a time or numeric x axis, stacked by default. Port of `charts/area.ts`.

use super::xy::{finish, markers, max, to_series_data, y_scale, Parts, XScale};
use crate::axis::xy_axes;
use crate::chart::{Ctx, Error, Rendered, MARGIN};
use crate::color::SeriesColors;
use crate::path::{area, raw};
use crate::views::xy::PathMark;

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let stacked = c.spec.stacked.unwrap_or(true);
    let fmt = c.fmt(".3~s");
    let height = c.height(240);
    let (w, h) = c.inner(height, MARGIN);
    let data = to_series_data(c, x_field, y_field)?;
    let x = XScale::new(&data, w);

    // Missing points count as 0 so stacks stay continuous. Bands are (key, [(y0, y1)] per x).
    let wide = |k: &str| {
        (0..data.xs.len())
            .map(|i| data.get(i, k).unwrap_or(0.0))
            .collect::<Vec<_>>()
    };
    let mut bands: Vec<(&String, Vec<(f64, f64)>)> = Vec::new();
    for k in &data.keys {
        let values = wide(k);
        let points = match (stacked, bands.last()) {
            // d3.stackOffsetNone: each layer starts at the top of the one before (its base when that top is NaN).
            (true, Some((_, prev))) => values
                .iter()
                .zip(prev)
                .map(|(v, &(p0, p1))| {
                    let y0 = if p1.is_nan() { p0 } else { p1 };
                    (y0, y0 + v)
                })
                .collect(),
            _ => values.iter().map(|&v| (0.0, v)).collect(),
        };
        bands.push((k, points));
    }
    let top = max(bands
        .iter()
        .filter_map(|(_, pts)| max(pts.iter().map(|p| p.1))))
    .unwrap_or(1.0);
    let top = if top == 0.0 || top.is_nan() { 1.0 } else { top };
    let y = y_scale([0.0, top], h);
    let colors = SeriesColors::new(c.theme, &data.keys);
    let axes = xy_axes(x.axis(), crate::axis::Scale::Linear(&y), w, h, &fmt, false);

    let paths: Vec<PathMark> = bands
        .iter()
        .map(|(k, pts)| {
            let pts: Vec<(f64, f64, f64)> = data
                .xs
                .iter()
                .zip(pts)
                .map(|(&xv, &(y0, y1))| (x.map(xv), y.map(y0), y.map(y1)))
                .collect();
            let color = colors.get(k);
            PathMark {
                d: area(&pts),
                fill: color.into(),
                fill_opacity: Some(raw(if stacked { 0.85 } else { 0.35 })),
                stroke: color.into(),
                stroke_width: raw(if stacked { 0.0 } else { 1.5 }),
            }
        })
        .collect();
    let markers = markers(c, &y, w, &fmt);
    finish(
        c,
        Parts {
            height,
            axes: &axes,
            paths: &paths,
            rects: &[],
            markers: &markers,
            keys: &data.keys,
            colors: &colors,
        },
    )
}
