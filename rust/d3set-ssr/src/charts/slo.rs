//! `slo`: the share of rows where `y` passes `objective.good`, against `objective.target` (percent),
//! with the error budget left. Port of `charts/slo.ts`.

use crate::chart::{Ctx, Error, Rendered};
use crate::format::{js_number, Format};
use crate::views;

/// What the template shows. `value_color` and `fill_style` are `None` before the first value.
pub struct Slo {
    pub value: String,
    pub value_color: Option<&'static str>,
    pub meta: String,
    pub fill_style: Option<String>,
}

/// `matchThreshold(v, [good])`.
fn passes(op: &str, limit: f64, v: f64) -> bool {
    match op {
        ">" => v > limit,
        ">=" => v >= limit,
        "<" => v < limit,
        "<=" => v <= limit,
        "=" => v == limit,
        _ => false,
    }
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let y_field = c.need("y")?;
    let Some(objective) = &c.spec.objective else {
        return Err(Error(
            "d3set: chart type 'slo' requires field 'objective'.".into(),
        ));
    };
    let target = objective.target;
    let pct = Format::new(".2~%");
    let height = c.height(96);
    let theme = c.theme;

    let values: Vec<f64> = c
        .rows
        .iter()
        .map(|r| r.num(y_field))
        .filter(|v| v.is_finite())
        .collect();
    let slo = if values.is_empty() {
        Slo {
            value: "–".into(),
            value_color: None,
            meta: format!("Target {}%", js_number(target)),
            fill_style: None,
        }
    } else {
        let good = values
            .iter()
            .filter(|&&v| passes(objective.good_op, objective.good_value, v))
            .count();
        let ratio = good as f64 / values.len() as f64;
        // Budget: the allowed bad share minus the used bad share, as a part of the allowed share.
        let allowed = 1.0 - target / 100.0;
        let budget = if allowed > 0.0 {
            (allowed - (1.0 - ratio)) / allowed
        } else if ratio == 1.0 {
            1.0
        } else {
            -1.0
        };
        let ok = ratio * 100.0 >= target;
        let fill = if budget > 0.25 {
            theme.positive
        } else if budget > 0.0 {
            theme.warning
        } else {
            theme.negative
        };
        Slo {
            value: pct.format(ratio),
            value_color: Some(if ok { theme.positive } else { theme.negative }),
            meta: format!(
                "Target {}% · Error budget left {}",
                js_number(target),
                pct.format(budget)
            ),
            fill_style: Some(format!(
                "width: {}%; background: {fill};",
                js_number(budget.clamp(0.0, 1.0) * 100.0)
            )),
        }
    };

    let body = rsx::Template::render_to_string(views::slo::Slo { slo: &slo })?;
    Ok(Rendered {
        body,
        height,
        class: "d3s-slo",
        ..Default::default()
    })
}
