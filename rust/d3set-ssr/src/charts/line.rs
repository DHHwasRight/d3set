//! `line`: one line per series over a time or numeric x axis. Port of `charts/line.ts`.

use super::xy::{
    curve_of, finish, look_of, margin_of, markers, max, min, to_series_data, y_scale, Parts, XScale,
};
use crate::axis::{xy_axes_with, Edges};
use crate::chart::{Ctx, Error, Rendered, MARGIN};
use crate::color::SeriesColors;
use crate::path::line_with;
use crate::views::xy::PathMark;

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let fmt = c.fmt(".3~s");
    let axis_fmt = c.axis_fmt(".3~s");
    let height = c.height(240);
    let margin = margin_of(c.spec, MARGIN, false);
    let (w, h) = c.inner(height, margin);
    let data = to_series_data(c, x_field, y_field)?;
    let x = XScale::new(&data, w);
    let all: Vec<f64> = data
        .table
        .iter()
        .flat_map(|m| m.iter().map(|e| e.1))
        .collect();
    let y = y_scale(
        [
            min(all.iter().copied()).unwrap_or(0.0).min(0.0),
            max(all.iter().copied()).unwrap_or(1.0),
        ],
        h,
    );
    let colors = SeriesColors::new(c.theme, &data.keys);
    let look = look_of(c.spec, || Edges::Num(Edges::of(&data.xs)));
    let axes = xy_axes_with(
        x.axis(),
        crate::axis::Scale::Linear(&y),
        w,
        h,
        &axis_fmt,
        false,
        &look,
    );
    let curve = curve_of(c.spec);

    let paths: Vec<PathMark> = data
        .keys
        .iter()
        .map(|k| {
            let pts: Vec<(f64, f64)> = data
                .xs
                .iter()
                .enumerate()
                .filter_map(|(i, &xv)| data.get(i, k).map(|v| (x.map(xv), y.map(v))))
                .collect();
            PathMark {
                d: line_with(&pts, curve),
                fill: "none".into(),
                fill_opacity: None,
                stroke: colors.get(k).into(),
                stroke_width: Some("2".into()),
            }
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
            paths: &paths,
            lines: None,
            rects: &[],
            markers: &markers,
            keys: &data.keys,
            colors: &colors,
        },
    )
}
