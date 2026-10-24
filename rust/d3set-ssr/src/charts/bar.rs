//! `bar`: values per category, grouped or stacked, vertical or horizontal. Port of `charts/bar.ts`.

use crate::agg::{aggregate, by_name, groups, rollup, top_n};
use crate::axis::{xy_axes, Scale};
use crate::chart::{Ctx, Error, LegendItem, Margin, Rendered, MARGIN};
use crate::color::SeriesColors;
use crate::path::raw;
use crate::scale::{Band, Linear};
use crate::spec::Agg;
use crate::views;

/// One rectangle, ready for the template.
pub struct BarRect {
    pub x: String,
    pub y: String,
    pub width: String,
    pub height: String,
    pub fill: &'static str,
    pub title: String,
}

struct Bar {
    category: String,
    series: String,
    value: f64,
    v0: f64,
    v1: f64,
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let how = c.aggregate(Agg::Sum);
    let horizontal = c.spec.horizontal.unwrap_or(false);
    let stacked = c.spec.stacked.unwrap_or(false);
    let fmt = c.fmt(".3~s");
    let height = c.height(240);
    let margin = if horizontal {
        Margin {
            left: 88.0,
            ..MARGIN
        }
    } else {
        MARGIN
    };
    let (w, h) = c.inner(height, margin);

    // Keep the largest categories when `limit` is set. The others become "Other".
    let kept: Option<Vec<String>> = c.spec.limit.map(|limit| {
        let totals = rollup(c.rows, |r| r.text(x_field), y_field, how);
        top_n(totals, Some(limit))
            .into_iter()
            .map(|(k, _)| k)
            .collect()
    });
    let cat_of = |r: &crate::value::Row| {
        let k = r.text(x_field);
        match &kept {
            Some(kept) if !kept.contains(&k) => "Other".to_string(),
            _ => k,
        }
    };
    let nested: Vec<(String, Vec<(String, f64)>)> = groups(c.rows, cat_of)
        .into_iter()
        .map(|(cat, list)| {
            let inner = groups(&list.into_iter().cloned().collect::<Vec<_>>(), |r| {
                c.series_of(r, y_field)
            })
            .into_iter()
            .map(|(s, rs)| {
                (
                    s,
                    aggregate(&rs.iter().map(|r| r.num(y_field)).collect::<Vec<_>>(), how),
                )
            })
            .collect();
            (cat, inner)
        })
        .collect();

    let mut categories: Vec<String> = nested.iter().map(|(k, _)| k.clone()).collect();
    let mut series_keys: Vec<String> = Vec::new();
    for (_, inner) in &nested {
        for (s, _) in inner {
            if !series_keys.contains(s) {
                series_keys.push(s.clone());
            }
        }
    }
    series_keys.sort_by(|a, b| by_name(a, b));
    // Stable order, so bars do not move while live data slides: by value with `limit`, else by name.
    if c.spec.limit.is_some() {
        let total = |cat: &str| {
            nested
                .iter()
                .find(|(k, _)| k == cat)
                .map_or(0.0, |(_, v)| v.iter().map(|e| e.1).sum())
        };
        categories.sort_by(|a, b| match (a.as_str(), b.as_str()) {
            ("Other", _) => std::cmp::Ordering::Greater,
            (_, "Other") => std::cmp::Ordering::Less,
            _ => total(b).total_cmp(&total(a)),
        });
    } else {
        categories.sort_by(|a, b| by_name(a, b));
    }

    let value_of = |cat: &str, s: &str| {
        nested
            .iter()
            .find(|(k, _)| k == cat)
            .and_then(|(_, inner)| inner.iter().find(|(k, _)| k == s))
            .map(|e| e.1)
    };
    let mut bars = Vec::new();
    if stacked {
        // d3.stackOffsetDiverging, then series-major order like `stack.flatMap(layer => layer.map(...))`:
        // positives stack up from 0, negatives down, and a zero value sits at 0.
        let mut pos = vec![0.0; categories.len()];
        let mut neg = vec![0.0; categories.len()];
        for s in &series_keys {
            for (j, cat) in categories.iter().enumerate() {
                let v = value_of(cat, s).unwrap_or(0.0);
                let (v0, v1) = if v > 0.0 {
                    pos[j] += v;
                    (pos[j] - v, pos[j])
                } else if v < 0.0 {
                    neg[j] += v;
                    (neg[j], neg[j] - v)
                } else {
                    (0.0, v)
                };
                bars.push(Bar {
                    category: cat.clone(),
                    series: s.clone(),
                    value: v,
                    v0,
                    v1,
                });
            }
        }
    } else {
        for (cat, inner) in &nested {
            for (s, v) in inner {
                bars.push(Bar {
                    category: cat.clone(),
                    series: s.clone(),
                    value: *v,
                    v0: v.min(0.0),
                    v1: v.max(0.0),
                });
            }
        }
    }

    let band = Band::new(
        categories.clone(),
        if horizontal { [0.0, h] } else { [0.0, w] },
        0.2,
        0.1,
    );
    let sub_domain = if stacked {
        vec!["all".to_string()]
    } else {
        series_keys.clone()
    };
    let sub = Band::padded(sub_domain, [0.0, band.bandwidth], 0.05);
    let lo = bars.iter().map(|b| b.v0).fold(0.0, f64::min);
    let hi = bars.iter().map(|b| b.v1).fold(0.0, f64::max);
    let hi = if hi == 0.0 && lo == 0.0 { 1.0 } else { hi };
    let value = Linear::new([lo, hi], if horizontal { [0.0, w] } else { [h, 0.0] }).nice(10.0);
    let colors = SeriesColors::new(c.theme, &series_keys);

    let axes = if horizontal {
        xy_axes(Scale::Linear(&value), Scale::Band(&band), w, h, &fmt, true)
    } else {
        xy_axes(Scale::Band(&band), Scale::Linear(&value), w, h, &fmt, false)
    };
    let rects = bars
        .iter()
        .map(|b| {
            let offset = band.map(&b.category).unwrap_or(0.0)
                + sub
                    .map(if stacked { "all" } else { &b.series })
                    .unwrap_or(0.0);
            let (x, y, width, height) = if horizontal {
                (
                    value.map(b.v0),
                    offset,
                    (value.map(b.v1) - value.map(b.v0)).abs(),
                    sub.bandwidth,
                )
            } else {
                (
                    offset,
                    value.map(b.v1),
                    sub.bandwidth,
                    (value.map(b.v0) - value.map(b.v1)).abs(),
                )
            };
            BarRect {
                x: raw(x),
                y: raw(y),
                width: raw(width),
                height: raw(height),
                fill: colors.get(&b.series),
                title: format!("{} · {}: {}", b.category, b.series, fmt.format(b.value)),
            }
        })
        .collect::<Vec<_>>();

    let body = rsx::Template::render_to_string(views::bar::Bar {
        width: c.width,
        height,
        axes: &axes,
        margin,
        rects: &rects,
        radius: c.theme.radius.min(3.0),
    })?;
    Ok(Rendered {
        body,
        height,
        legend: series_keys
            .iter()
            .map(|k| LegendItem {
                key: k.clone(),
                color: colors.get(k).to_string(),
            })
            .collect(),
        has_legend: true,
        ..Default::default()
    })
}
