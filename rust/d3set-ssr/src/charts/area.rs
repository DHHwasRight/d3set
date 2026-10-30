//! `area`: filled areas over a time or numeric x axis, stacked by default. Port of `charts/area.ts`.
//! `options.gradient`: each area is filled with a vertical gradient of its color and not stroked;
//! a 2px `path.d3s-area-line` per series draws only its top edge, in a group after the areas.

use super::xy::{
    curve_of, finish, gradient_id, look_of, margin_of, markers, max, to_series_data, y_scale,
    Parts, XScale,
};
use crate::axis::{xy_axes_with, Edges};
use crate::chart::{Ctx, Error, Rendered, MARGIN};
use crate::color::SeriesColors;
use crate::path::{area_with, line_with, raw};
use crate::views::xy::{Gradient, PathMark};

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let stacked = c.spec.stacked.unwrap_or(true);
    let gradient = c.spec.flag("gradient");
    let fmt = c.fmt(".3~s");
    let height = c.height(240);
    let margin = margin_of(c.spec, MARGIN, false);
    let (w, h) = c.inner(height, margin);
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
    let curve = curve_of(c.spec);
    // Gradient ids follow the series index among all keys (TS `data.keys`), here the same as the bands.
    let gradients: Vec<Gradient> = bands
        .iter()
        .enumerate()
        .map(|(i, (k, _))| Gradient {
            id: gradient_id(c.spec, i),
            color: colors.get(k).into(),
        })
        .collect();

    // Pixel points per band: (x, y0, y1).
    let pixels: Vec<Vec<(f64, f64, f64)>> = bands
        .iter()
        .map(|(_, pts)| {
            data.xs
                .iter()
                .zip(pts)
                .map(|(&xv, &(y0, y1))| (x.map(xv), y.map(y0), y.map(y1)))
                .collect()
        })
        .collect();
    let paths: Vec<PathMark> = bands
        .iter()
        .zip(&gradients)
        .zip(&pixels)
        .map(|(((k, _), g), pts)| {
            let color = colors.get(k);
            if gradient {
                PathMark {
                    d: area_with(pts, curve),
                    fill: format!("url(#{})", g.id),
                    fill_opacity: None,
                    stroke: "none".into(),
                    stroke_width: None,
                }
            } else {
                PathMark {
                    d: area_with(pts, curve),
                    fill: color.into(),
                    fill_opacity: Some(raw(if stacked { 0.85 } else { 0.35 })),
                    stroke: color.into(),
                    stroke_width: Some(raw(if stacked { 0.0 } else { 1.5 })),
                }
            }
        })
        .collect();
    // Gradient mode: the outline is only the top edge of each area, with the same curve.
    let lines: Vec<PathMark> = bands
        .iter()
        .zip(&pixels)
        .map(|((k, _), pts)| PathMark {
            d: line_with(
                &pts.iter().map(|&(px, _, y1)| (px, y1)).collect::<Vec<_>>(),
                curve,
            ),
            fill: "none".into(),
            fill_opacity: None,
            stroke: colors.get(k).into(),
            stroke_width: Some("2".into()),
        })
        .collect();
    let markers = markers(c, &y, w, &fmt);
    finish(
        c,
        Parts {
            height,
            margin,
            gradients: gradient.then_some(&gradients[..]),
            axes: &axes,
            paths: &paths,
            lines: gradient.then_some(&lines[..]),
            rects: &[],
            markers: &markers,
            keys: &data.keys,
            colors: &colors,
        },
    )
}
