//! `funnel`: stages of a process, widest first: value `y` per stage `x`. Port of `charts/funnel.ts`.

use crate::agg::rollup;
use crate::chart::{Ctx, Error, Margin, Rendered};
use crate::color::{text_on, SeriesColors};
use crate::format::Format;
use crate::path::raw;
use crate::scale::{Band, Linear};
use crate::spec::Agg;
use crate::value::Value;
use crate::views;

/// One stage, ready for the template.
pub struct Stage {
    pub transform: String,
    pub x: String,
    pub width: String,
    pub fill: &'static str,
    pub text_fill: &'static str,
    pub label: String,
}

const MARGIN: Margin = Margin {
    top: 4.0,
    right: 4.0,
    bottom: 4.0,
    left: 4.0,
};

/// JavaScript truthiness of an option value.
fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Num(n) => *n != 0.0 && !n.is_nan(),
        Value::Str(s) => !s.is_empty(),
    }
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let fmt = c.fmt(".3~s");
    let pct = Format::new(".1%");
    let height = c.height(240);
    let (w, h) = c.inner(height, MARGIN);

    let mut entries = rollup(c.rows, |r| r.text(x_field), y_field, c.aggregate(Agg::Sum));
    if c.spec.options.iter().any(|(k, v)| k == "sort" && truthy(v)) {
        // `(a, b) => b[1] - a[1]`, a stable sort.
        entries.sort_by(|a, b| {
            (b.1 - a.1)
                .partial_cmp(&0.0)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
    }
    let first = entries.first().map_or(0.0, |e| e.1);
    let of_first = |v: f64| {
        if first != 0.0 && !first.is_nan() {
            v / first
        } else {
            0.0
        }
    };

    let names: Vec<String> = entries.iter().map(|e| e.0.clone()).collect();
    let band = Band::padded(names.clone(), [0.0, h], 0.12);
    let max = entries
        .iter()
        .map(|e| e.1)
        .filter(|v| !v.is_nan())
        .reduce(f64::max)
        .unwrap_or(0.0);
    let width = Linear::new([0.0, if max != 0.0 { max } else { 1.0 }], [0.0, w]);
    let colors = SeriesColors::new(c.theme, &names);

    let stages = entries
        .iter()
        .map(|(name, value)| {
            let fill = colors.get(name);
            Stage {
                transform: format!("translate(0,{})", raw(band.map(name).unwrap_or(0.0))),
                x: raw((w - width.map(*value)) / 2.0),
                width: raw(width.map(*value)),
                fill,
                text_fill: text_on(c.theme, fill),
                label: format!(
                    "{name} · {} · {}",
                    fmt.format(*value),
                    pct.format(of_first(*value))
                ),
            }
        })
        .collect::<Vec<_>>();

    let body = rsx::Template::render_to_string(views::funnel::Funnel {
        width: c.width,
        height,
        margin: MARGIN,
        stages: &stages,
        bandwidth: band.bandwidth,
        mid: w / 2.0,
        radius: c.theme.radius.min(4.0),
    })?;
    Ok(Rendered {
        body,
        height,
        ..Default::default()
    })
}
