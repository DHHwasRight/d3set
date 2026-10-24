//! `sunburst`: two-level share of a total. Inner ring per `series` value, outer ring per `x`
//! value. Port of `charts/sunburst.ts` (`d3.hierarchy` + `d3.partition`).

use std::f64::consts::TAU;

use crate::agg::{aggregate, by_name, groups};
use crate::chart::{Ctx, Error, LegendItem, Rendered};
use crate::color::SeriesColors;
use crate::spec::Agg;
use crate::value::Row;
use crate::views;

use super::pie::arc;

/// One arc of a ring, ready for the template.
pub struct Ring {
    pub d: String,
    pub fill: &'static str,
    pub fill_opacity: &'static str,
}

/// A hierarchy node: its name, its summed value, and its children (sorted by value, descending).
struct Node {
    name: String,
    value: f64,
    children: Vec<Node>,
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let group_field = c.need("series")?;
    let how = c.aggregate(Agg::Sum);
    let height = c.height(240);
    let margin = 4.0;
    let w = (c.width - 2.0 * margin).max(0.0);
    let h = (height - 2.0 * margin).max(0.0);
    let r = (w.min(h) / 2.0).max(0.0);

    // d3.rollups(rows, agg, group, x): first-seen order on both levels.
    let agg = |rs: &[&Row]| {
        aggregate(
            &rs.iter().map(|row| row.num(y_field)).collect::<Vec<_>>(),
            how,
        )
    };
    let mut tops: Vec<Node> = groups(c.rows, |row| row.text(group_field))
        .into_iter()
        .map(|(name, list)| {
            let owned: Vec<Row> = list.into_iter().cloned().collect();
            let children = groups(&owned, |row| row.text(x_field))
                .into_iter()
                .map(|(leaf, rs)| Node {
                    name: leaf,
                    value: hierarchy_value(agg(&rs)),
                    children: vec![],
                })
                .collect();
            Node {
                name,
                value: 0.0,
                children,
            }
        })
        .collect();
    let group_names: Vec<String> = {
        let mut g: Vec<String> = tops.iter().map(|n| n.name.clone()).collect();
        g.sort_by(|a, b| by_name(a, b));
        g
    };

    // node.sum(): own value (0 for groups) plus the children, summed last to first.
    for top in &mut tops {
        top.value = top.children.iter().rev().fold(0.0, |s, ch| s + ch.value);
    }
    let total = tops.iter().rev().fold(0.0, |s, t| s + t.value);
    // node.sort((a, b) => b.value - a.value): a stable sort on every level.
    for top in &mut tops {
        top.children.sort_by(|a, b| desc(a.value, b.value));
    }
    tops.sort_by(|a, b| desc(a.value, b.value));

    // d3.partition().size([2π, 3]), then descendants() in breadth-first order without the root.
    let colors = SeriesColors::new(c.theme, &group_names);
    let ring = |depth: usize, group: &str, x0: f64, x1: f64| {
        let (inner, outer) = if depth == 1 { (0.3, 0.62) } else { (0.64, 1.0) };
        Ring {
            d: arc(r * inner, r * outer, x0, x1, 0.006, 0.0),
            fill: colors.get(group),
            fill_opacity: if depth == 1 { "1" } else { "0.6" },
        }
    };
    let mut level1 = Vec::new();
    let mut level2 = Vec::new();
    let mut x = 0.0;
    let k = if total != 0.0 { TAU / total } else { 0.0 };
    for top in &tops {
        let x0 = x;
        x += top.value * k;
        let x1 = x;
        level1.push(ring(1, &top.name, x0, x1));
        let kk = if top.value != 0.0 {
            (x1 - x0) / top.value
        } else {
            0.0
        };
        let mut cx = x0;
        for leaf in &top.children {
            let c0 = cx;
            cx += leaf.value * kk;
            level2.push(ring(2, &top.name, c0, cx));
        }
    }
    level1.extend(level2);

    let body = rsx::Template::render_to_string(views::sunburst::Sunburst {
        width: c.width,
        height,
        transform: views::frame::translate(margin + w / 2.0, margin + h / 2.0),
        arcs: &level1,
    })?;
    Ok(Rendered {
        body,
        height,
        legend: group_names
            .iter()
            .map(|k| LegendItem {
                key: k.clone(),
                color: colors.get(k).to_string(),
            })
            .collect(),
        force_legend: true,
        has_legend: true,
        ..Default::default()
    })
}

/// `+Math.max(0, value) || 0`: negative and NaN values count as 0.
fn hierarchy_value(v: f64) -> f64 {
    if v.is_nan() {
        0.0
    } else {
        v.max(0.0)
    }
}

/// `(a, b) => b - a` as a sort comparator.
fn desc(a: f64, b: f64) -> std::cmp::Ordering {
    let d = b - a;
    if d < 0.0 {
        std::cmp::Ordering::Less
    } else if d > 0.0 {
        std::cmp::Ordering::Greater
    } else {
        std::cmp::Ordering::Equal
    }
}
