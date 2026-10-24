//! `boxplot`: distribution of `y` per category `x`: quartiles, whiskers at 1.5 × IQR, and outlier
//! dots. Port of `charts/boxplot.ts`.

use super::histogram::nice_linear;
use crate::agg::{by_name, groups};
use crate::axis::{xy_axes, Scale};
use crate::chart::{Ctx, Error, Rendered, MARGIN};
use crate::color::SeriesColors;
use crate::path::raw;
use crate::scale::Band;
use crate::views;

/// One box, ready for the template.
pub struct BoxMarks {
    pub transform: String,
    pub color: &'static str,
    pub whisker_y1: String,
    pub whisker_y2: String,
    pub y: String,
    pub height: String,
    pub median: String,
    pub outliers: Vec<String>,
}

struct BoxStats {
    category: String,
    q1: f64,
    median: f64,
    q3: f64,
    lo: f64,
    hi: f64,
    outliers: Vec<f64>,
}

/// `d3.quantileSorted(values, p)`.
fn quantile_sorted(v: &[f64], p: f64) -> Option<f64> {
    let n = v.len();
    if n == 0 {
        return None;
    }
    if p <= 0.0 || n < 2 {
        return Some(v[0]);
    }
    if p >= 1.0 {
        return Some(v[n - 1]);
    }
    let i = (n - 1) as f64 * p;
    let i0 = i.floor() as usize;
    Some(v[i0] + (v[i0 + 1] - v[i0]) * (i - i0 as f64))
}

fn to_box(category: String, mut v: Vec<f64>) -> BoxStats {
    v.sort_by(f64::total_cmp);
    let q1 = quantile_sorted(&v, 0.25).unwrap_or(0.0);
    let median = quantile_sorted(&v, 0.5).unwrap_or(0.0);
    let q3 = quantile_sorted(&v, 0.75).unwrap_or(0.0);
    let iqr = q3 - q1;
    let (fence_lo, fence_hi) = (q1 - 1.5 * iqr, q3 + 1.5 * iqr);
    let inside: Vec<f64> = v
        .iter()
        .copied()
        .filter(|&x| x >= fence_lo && x <= fence_hi)
        .collect();
    BoxStats {
        category,
        q1,
        median,
        q3,
        lo: inside.first().copied().unwrap_or(q1),
        hi: inside.last().copied().unwrap_or(q3),
        outliers: v
            .iter()
            .copied()
            .filter(|&x| x < fence_lo || x > fence_hi)
            .collect(),
    }
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let fmt = c.fmt(".3~s");
    let height = c.height(240);
    let (w, h) = c.inner(height, MARGIN);

    let mut boxes: Vec<BoxStats> = groups(c.rows, |r| r.text(x_field))
        .into_iter()
        .map(|(cat, list)| {
            to_box(
                cat,
                list.iter()
                    .map(|r| r.num(y_field))
                    .filter(|v| v.is_finite())
                    .collect(),
            )
        })
        .collect();
    boxes.sort_by(|a, b| by_name(&a.category, &b.category));

    let categories: Vec<String> = boxes.iter().map(|b| b.category.clone()).collect();
    let x = Band::padded(categories.clone(), [0.0, w], 0.4);
    let lo = boxes
        .iter()
        .map(|b| b.outliers.iter().copied().fold(b.lo, f64::min))
        .reduce(f64::min)
        .unwrap_or(0.0);
    let hi = boxes
        .iter()
        .map(|b| b.outliers.iter().copied().fold(b.hi, f64::max))
        .reduce(f64::max)
        .unwrap_or(1.0);
    let y = nice_linear([lo, hi], [h, 0.0], 10.0);
    let colors = SeriesColors::new(c.theme, &categories);
    let axes = xy_axes(Scale::Band(&x), Scale::Linear(&y), w, h, &fmt, false);

    let marks: Vec<BoxMarks> = boxes
        .iter()
        .map(|b| BoxMarks {
            transform: format!("translate({},0)", raw(x.map(&b.category).unwrap_or(0.0))),
            color: colors.get(&b.category),
            whisker_y1: raw(y.map(b.lo)),
            whisker_y2: raw(y.map(b.hi)),
            y: raw(y.map(b.q3)),
            height: raw((y.map(b.q1) - y.map(b.q3)).max(1.0)),
            median: raw(y.map(b.median)),
            outliers: b.outliers.iter().map(|&v| raw(y.map(v))).collect(),
        })
        .collect();

    let bw = x.bandwidth;
    let body = rsx::Template::render_to_string(views::boxplot::Boxplot {
        width: c.width,
        height,
        axes: &axes,
        margin: MARGIN,
        boxes: &marks,
        half: raw(bw / 2.0),
        bandwidth: raw(bw),
        radius: raw(c.theme.radius.min(3.0)),
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
    fn quartiles_like_d3() {
        let b = to_box("a".into(), vec![1.0, 2.0, 3.0, 4.0, 100.0]);
        assert_eq!((b.q1, b.median, b.q3), (2.0, 3.0, 4.0));
        assert_eq!((b.lo, b.hi), (1.0, 4.0));
        assert_eq!(b.outliers, [100.0]);
    }
}
