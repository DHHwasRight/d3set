//! `toplist`: ranked list of `x` values by the aggregate of `y`. Port of `charts/toplist.ts`.

use crate::agg::rollup;
use crate::chart::{Ctx, Error, Rendered};
use crate::format::js_number;
use crate::spec::{Agg, Threshold};
use crate::theme::Theme;
use crate::views;

/// What `selectOnClick` writes with no dashboard selection: full opacity and a pointer cursor.
pub(crate) const SELECTABLE: &str = "opacity: 1; cursor: pointer;";

/// `valueColor(theme, value, rules, fallback)`: the color of the first matching rule, else `fallback`.
pub(crate) fn value_color(
    theme: &Theme,
    value: f64,
    rules: &[Threshold],
    fallback: &str,
) -> String {
    rules
        .iter()
        .find(|t| t.matches(value))
        .map_or_else(|| fallback.to_string(), |t| threshold_color(theme, t))
}

/// `thresholdColor`: the rule's own color, else its level color (critical when it has no level).
pub(crate) fn threshold_color(theme: &Theme, t: &Threshold) -> String {
    match &t.color {
        Some(c) => c.clone(),
        None => level_color(theme, t.level.map_or("critical", |l| l.name())).to_string(),
    }
}

/// `levelColor`.
pub(crate) fn level_color(_theme: &Theme, level: &str) -> &'static str {
    match level {
        "ok" => "var(--d3s-positive)",
        "warning" => "var(--d3s-warning)",
        _ => "var(--d3s-negative)",
    }
}

/// A JavaScript sort comparator result: NaN counts as equal.
pub(crate) fn js_order(d: f64) -> std::cmp::Ordering {
    d.partial_cmp(&0.0).unwrap_or(std::cmp::Ordering::Equal)
}

/// One line of the list, ready for the template.
pub struct TopRow {
    pub rank: String,
    pub name: String,
    pub value: String,
    pub title: String,
    pub bar_style: String,
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let fmt = c.fmt(".3~s");
    let height = c.height(240);
    let sign = if c.spec.flag("ascending") { 1.0 } else { -1.0 };
    let mut entries = rollup(c.rows, |r| r.text(x_field), y_field, c.aggregate(Agg::Sum));
    entries.sort_by(|a, b| js_order(sign * (a.1 - b.1)));
    entries.truncate(c.spec.limit.unwrap_or(10));

    // `d3.max(entries, abs) || 1`: d3.max skips NaN; 0 and no entries give 1.
    let max = entries
        .iter()
        .map(|e| e.1.abs())
        .filter(|v| !v.is_nan())
        .fold(None, |m: Option<f64>, v| Some(m.map_or(v, |m| m.max(v))));
    let max = match max {
        Some(m) if m != 0.0 => m,
        _ => 1.0,
    };
    let rows = entries
        .iter()
        .enumerate()
        .map(|(i, (name, value))| {
            let v = fmt.format(*value);
            TopRow {
                rank: (i + 1).to_string(),
                name: name.clone(),
                title: format!("{name}: {v}"),
                value: v,
                bar_style: format!(
                    "width: {}%; background: {};",
                    js_number(value.abs() / max * 100.0),
                    value_color(c.theme, *value, &c.spec.thresholds, "var(--d3s-accent)")
                ),
            }
        })
        .collect::<Vec<_>>();

    let body = rsx::Template::render_to_string(views::toplist::Toplist {
        rows: &rows,
        row_style: SELECTABLE,
    })?;
    Ok(Rendered {
        body,
        height,
        ..Default::default()
    })
}
