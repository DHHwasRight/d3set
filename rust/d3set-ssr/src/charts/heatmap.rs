//! `heatmap`: a grid of `x` columns by `series` rows, colored by the aggregate of `y`.
//! Port of `charts/heatmap.ts`.

use super::histogram::sequential;
use crate::agg::{aggregate, by_name, extent, groups};
use crate::axis::{xy_axes, Scale};
use crate::chart::{Ctx, Error, Margin, Rendered, MARGIN};
use crate::path::raw;
use crate::scale::Band;
use crate::spec::Agg;
use crate::views;

/// One cell, ready for the template.
pub struct HeatCell {
    pub x: String,
    pub y: String,
    pub fill: String,
    pub opacity: &'static str,
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let row_field = c.need("series")?;
    let how = c.aggregate(Agg::Sum);
    let fmt = c.fmt(".3~s");
    let height = c.height(240);
    let margin = Margin {
        left: 72.0,
        ..MARGIN
    };
    let (w, h) = c.inner(height, margin);

    // d3.rollups by x, then by row: first-seen order.
    let mut cells: Vec<(String, String, f64)> = Vec::new();
    for (x, list) in groups(c.rows, |r| r.text(x_field)) {
        let list: Vec<_> = list.into_iter().cloned().collect();
        for (row, rs) in groups(&list, |r| r.text(row_field)) {
            let values: Vec<f64> = rs.iter().map(|r| r.num(y_field)).collect();
            cells.push((x.clone(), row, aggregate(&values, how)));
        }
    }

    let sorted = |keys: Vec<&String>| {
        let mut k: Vec<String> = Vec::new();
        for key in keys {
            if !k.contains(key) {
                k.push(key.clone());
            }
        }
        k.sort_by(|a, b| by_name(a, b));
        k
    };
    let xs = sorted(cells.iter().map(|c| &c.0).collect());
    let row_keys = sorted(cells.iter().map(|c| &c.1).collect());
    let x = Band::padded(xs.clone(), [0.0, w], 0.04);
    let y = Band::padded(row_keys, [0.0, h], 0.04);
    let values = || cells.iter().map(|c| c.2);
    let lo = extent(values()).map_or(0.0, |e| e[0]);
    let hi = extent(values()).map_or(1.0, |e| e[1]);

    let mut axes = xy_axes(Scale::Band(&x), Scale::Band(&y), w, h, &fmt, true);
    // The TS chart removes the grid lines.
    axes.grid.ticks.clear();
    // Too many columns: show every n-th label.
    let every = (xs.len() as f64 / (w / 48.0).max(1.0)).ceil() as usize;
    let tick_opacity: Vec<&'static str> = (0..axes.x.ticks.len())
        .map(|i| {
            if every == 0 || i % every == 0 {
                "1"
            } else {
                "0"
            }
        })
        .collect();

    let rects: Vec<HeatCell> = cells
        .iter()
        .map(|(cx, row, v)| HeatCell {
            x: raw(x.map(cx).unwrap_or(0.0)),
            y: raw(y.map(row).unwrap_or(0.0)),
            fill: sequential(c.theme, [lo, hi], *v),
            // No selection on a first render.
            opacity: "1",
        })
        .collect();

    let body = rsx::Template::render_to_string(views::heatmap::Heatmap {
        width: c.width,
        height,
        axes: &axes,
        margin,
        tick_opacity: &tick_opacity,
        cells: &rects,
        cell_width: raw(x.bandwidth),
        cell_height: raw(y.bandwidth),
        radius: raw(c.theme.radius.min(2.0)),
    })?;
    Ok(Rendered {
        body,
        height,
        ..Default::default()
    })
}
