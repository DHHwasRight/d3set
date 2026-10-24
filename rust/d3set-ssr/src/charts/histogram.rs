//! `histogram`: distribution of the numeric field `y` in `bins` buckets. Port of `charts/histogram.ts`.
//!
//! Also holds the d3 helpers the distribution charts share: `nice` (d3-scale `linear.nice`) and
//! `bin` (d3-array `bin` with explicit thresholds).

use crate::agg::extent;
use crate::axis::{axis, xy_axes, Orient, Scale};
use crate::chart::{Ctx, Error, Rendered, MARGIN};
use crate::format::{js_number, Format};
use crate::path::raw;
use crate::scale::{tick_increment, Linear};
use crate::views;

/// `scaleLinear().domain(domain).nice(count).domain()`, exactly as d3-scale does it.
///
/// `scale::Linear::nice` writes the domain even when the loop stops without a stable step, so a
/// collapsed domain such as `[5, 5]` becomes `[NaN, NaN]`. d3 keeps the domain in that case.
pub(crate) fn nice(domain: [f64; 2], count: f64) -> [f64; 2] {
    let [mut start, mut stop] = domain;
    let reverse = stop < start;
    if reverse {
        std::mem::swap(&mut start, &mut stop);
    }
    let mut prestep = f64::NAN;
    for _ in 0..10 {
        let step = tick_increment(start, stop, count);
        if step == prestep {
            return if reverse {
                [stop, start]
            } else {
                [start, stop]
            };
        } else if step > 0.0 {
            start = (start / step).floor() * step;
            stop = (stop / step).ceil() * step;
        } else if step < 0.0 {
            start = (start * step).ceil() / step;
            stop = (stop * step).floor() / step;
        } else {
            break;
        }
        prestep = step;
    }
    domain
}

/// `sequentialColor(theme, domain)(x)`. d3's sequential scale maps every value of a collapsed
/// domain to the middle of the interpolator (0.5); `color::sequential` maps it to 0.
pub(crate) fn sequential(theme: &crate::theme::Theme, domain: [f64; 2], x: f64) -> String {
    if domain[0] == domain[1] {
        crate::color::interpolate_lab(theme.sequential[0], theme.sequential[1], 0.5).css()
    } else {
        crate::color::sequential(theme, domain, x)
    }
}

/// A `Linear` scale with a d3-niced domain.
pub(crate) fn nice_linear(domain: [f64; 2], range: [f64; 2], count: f64) -> Linear {
    Linear::new(nice(domain, count), range)
}

/// One bin of `d3.bin()`: `[x0, x1)`, the last one `[x0, x1]`.
pub(crate) struct Bin {
    pub x0: f64,
    pub x1: f64,
    pub len: usize,
}

/// `d3.bin().domain(domain).thresholds(thresholds)(values)`: thresholds outside the domain are
/// dropped, values outside the domain are ignored, and a value goes to `bisectRight(thresholds, v)`.
pub(crate) fn bin(values: &[f64], domain: [f64; 2], thresholds: &[f64]) -> Vec<Bin> {
    let [x0, x1] = domain;
    let mut a = 0;
    while a < thresholds.len() && thresholds[a] <= x0 {
        a += 1;
    }
    let mut b = thresholds.len();
    while b > 0 && thresholds[b - 1] > x1 {
        b -= 1;
    }
    let tz: &[f64] = if a < b { &thresholds[a..b] } else { &[] };
    let m = tz.len();
    let mut bins: Vec<Bin> = (0..=m)
        .map(|i| Bin {
            x0: if i > 0 { tz[i - 1] } else { x0 },
            x1: if i < m { tz[i] } else { x1 },
            len: 0,
        })
        .collect();
    for &v in values {
        if x0 <= v && v <= x1 {
            bins[tz.partition_point(|&t| t <= v)].len += 1;
        }
    }
    bins
}

/// One rectangle, ready for the template.
pub struct HistRect {
    pub x: String,
    pub y: String,
    pub width: String,
    pub height: String,
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let y_field = c.need("y")?;
    let fmt = c.fmt(".3~s");
    let height = c.height(240);
    let (w, h) = c.inner(height, MARGIN);
    let count = c.spec.bins.unwrap_or(20) as f64;

    let values: Vec<f64> = c
        .rows
        .iter()
        .map(|r| r.num(y_field))
        .filter(|v| v.is_finite())
        .collect();
    let ext = extent(values.iter().copied()).unwrap_or([0.0, 1.0]);
    let x = nice_linear(ext, [0.0, w], count);
    let bins = bin(&values, x.domain, &x.ticks(count));
    let most = bins.iter().map(|b| b.len).max().unwrap_or(0);
    let y = nice_linear(
        [0.0, if most == 0 { 1.0 } else { most as f64 }],
        [h, 0.0],
        10.0,
    );

    // `renderAxes` with `~s` labels on y, then the x axis again with `fmt` labels and more ticks.
    let mut axes = xy_axes(
        Scale::Linear(&x),
        Scale::Linear(&y),
        w,
        h,
        &Format::new("~s"),
        false,
    );
    let label = |v: f64| fmt.format(v);
    let mut xa = axis(
        "d3s-axis-x",
        Orient::Bottom,
        &Scale::Linear(&x),
        (w / 80.0).max(2.0),
        Some(&label),
        6.0,
        true,
    );
    xa.transform = Some(format!("translate(0,{})", js_number(h)));
    axes.x = xa;

    let rects: Vec<HistRect> = bins
        .iter()
        .map(|b| {
            let len = b.len as f64;
            HistRect {
                x: raw(x.map(b.x0) + 1.0),
                width: raw((x.map(b.x1) - x.map(b.x0) - 1.0).max(0.0)),
                y: raw(y.map(len)),
                height: raw(h - y.map(len)),
            }
        })
        .collect();

    let body = rsx::Template::render_to_string(views::histogram::Histogram {
        width: c.width,
        height,
        axes: &axes,
        margin: MARGIN,
        rects: &rects,
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
    fn nice_keeps_a_collapsed_domain() {
        assert_eq!(nice([5.0, 5.0], 10.0), [5.0, 5.0]);
        assert_eq!(nice([0.2, 9.7], 10.0), [0.0, 10.0]);
        assert_eq!(nice([20.0, 499.0], 20.0), [20.0, 500.0]);
    }

    #[test]
    fn bin_like_d3() {
        // d3.bin().domain([0, 10]).thresholds([0, 5, 10])([0, 1, 5, 9, 10])
        let b = bin(&[0.0, 1.0, 5.0, 9.0, 10.0], [0.0, 10.0], &[0.0, 5.0, 10.0]);
        let got: Vec<(f64, f64, usize)> = b.iter().map(|b| (b.x0, b.x1, b.len)).collect();
        assert_eq!(got, [(0.0, 5.0, 2), (5.0, 10.0, 2), (10.0, 10.0, 1)]);
    }
}
