//! `gauge`: a half-circle gauge of the aggregate of `y` between `min` and `max`. Port of
//! `charts/gauge.ts`. Threshold rules color the arc and add ticks at their values.

use std::f64::consts::{FRAC_PI_2, PI};

use crate::agg::aggregate;
use crate::chart::{Ctx, Error, Rendered};
use crate::color::{level_var, seq_color};
use crate::path::raw;
use crate::spec::{Agg, Level, Threshold};
use crate::theme::Theme;
use crate::views;

use super::pie::arc;

/// One threshold tick on the outer edge of the arc.
pub struct Tick {
    pub stroke: String,
    pub x1: String,
    pub y1: String,
    pub x2: String,
    pub y2: String,
}

/// Everything the template draws.
pub struct GaugeView {
    pub transform: String,
    pub track: String,
    pub bar: String,
    pub fill: String,
    pub ticks: Vec<Tick>,
    pub label: String,
    pub label_y: String,
    pub label_style: String,
    pub low: String,
    pub low_x: String,
    pub high: String,
    pub high_x: String,
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let y_field = c.need("y")?;
    let min = c.spec.min.unwrap_or(0.0);
    let max = c.spec.max.unwrap_or(100.0);
    let fmt = c.fmt(",.0f");
    let height = c.height(160);
    let margin = 8.0;
    let w = (c.width - 2.0 * margin).max(0.0);
    let h = (height - 2.0 * margin).max(0.0);
    let r = (w / 2.0).min(h - 16.0).max(0.0);

    let values: Vec<f64> = c.rows.iter().map(|row| row.num(y_field)).collect();
    let value = aggregate(&values, c.aggregate(Agg::Sum));

    // d3.scaleLinear().domain([min, max]).range([-π/2, π/2]).clamp(true)
    let angle = |v: f64| {
        let (lo, hi) = if min <= max { (min, max) } else { (max, min) };
        let v = v.max(lo).min(hi);
        let (d0, d1, r0, r1) = if max < min {
            (max, min, FRAC_PI_2, -FRAC_PI_2)
        } else {
            (min, max, -FRAC_PI_2, FRAC_PI_2)
        };
        let span = d1 - d0;
        let t = if span != 0.0 { (v - d0) / span } else { 0.5 };
        r0 * (1.0 - t) + r1 * t
    };
    let corner = c.theme.radius.min(4.0);
    let gauge_arc = |end: f64| arc(r * 0.72, r, -FRAC_PI_2, end, 0.0, corner);

    let fallback = seq_color(0.35 + 0.65 * ((angle(value) + FRAC_PI_2) / PI));
    let fill = match c.spec.thresholds.iter().find(|t| t.matches(value)) {
        Some(t) => threshold_color(c.theme, t),
        None => fallback,
    };
    let ticks = c
        .spec
        .thresholds
        .iter()
        .filter(|t| t.value >= min && t.value <= max)
        .map(|t| {
            let a = angle(t.value);
            Tick {
                stroke: threshold_color(c.theme, t),
                x1: raw(a.sin() * r * 0.68),
                y1: raw(-a.cos() * r * 0.68),
                x2: raw(a.sin() * r * 1.04),
                y2: raw(-a.cos() * r * 1.04),
            }
        })
        .collect();

    let view = GaugeView {
        transform: views::frame::translate(margin + w / 2.0, margin + r),
        track: gauge_arc(FRAC_PI_2),
        bar: gauge_arc(angle(value)),
        fill,
        ticks,
        label: fmt.format(value),
        label_y: raw(-r * 0.12),
        label_style: format!(
            "font-size: {}px; font-weight: 600;",
            raw(14f64.max(r * 0.32))
        ),
        low: fmt.format(min),
        low_x: raw(-r * 0.86),
        high: fmt.format(max),
        high_x: raw(r * 0.86),
    };
    let body = rsx::Template::render_to_string(views::gauge::Gauge {
        width: c.width,
        height,
        g: &view,
    })?;
    Ok(Rendered {
        body,
        height,
        ..Default::default()
    })
}

/// `thresholdColor`: the rule's own color, else its level color (critical by default).
fn threshold_color(_theme: &Theme, t: &Threshold) -> String {
    if let Some(color) = &t.color {
        return color.clone();
    }
    level_var(t.level.unwrap_or(Level::Critical)).to_string()
}
