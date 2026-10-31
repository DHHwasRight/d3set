//! `treemap`: rectangles sized by the aggregate of `y` per `x`, optionally nested in one group per
//! `series` value. Port of `charts/treemap.ts`, with `d3.hierarchy` (`sum`, `sort`, `leaves`) and
//! `d3.treemap` (squarify, `paddingInner(2)`, `paddingTop`, `round(true)`) from d3-hierarchy.

use std::sync::atomic::{AtomicU64, Ordering};

use crate::agg::{aggregate, by_name, groups, top_n};
use crate::chart::{Ctx, Error, LegendItem, Rendered};
use crate::color::{text_on, SeriesColors};
use crate::path::raw;
use crate::spec::Agg;
use crate::value::Row;
use crate::views;

/// One tile, ready for the template.
pub struct Leaf {
    pub transform: String,
    pub width: String,
    pub height: String,
    pub fill: &'static str,
    pub text_fill: &'static str,
    pub clip_id: String,
    pub label: String,
}

/// A node of the hierarchy, as `d3.hierarchy` and `d3.treemap` set it.
struct Node {
    name: String,
    /// The data value (`d.value`), before `sum`.
    data_value: Option<f64>,
    /// `node.value` after `sum`.
    value: f64,
    children: Vec<usize>,
    parent: Option<usize>,
    depth: usize,
    x0: f64,
    y0: f64,
    x1: f64,
    y1: f64,
}

struct Tree {
    nodes: Vec<Node>,
}

/// JavaScript truthiness of a number.
fn truthy(x: f64) -> bool {
    x != 0.0 && !x.is_nan()
}

/// `Math.max` with two arguments: NaN wins.
fn js_max(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else {
        a.max(b)
    }
}

/// `Math.round`: halves round up.
fn js_round(x: f64) -> f64 {
    let f = x.floor();
    if x - f >= 0.5 {
        f + 1.0
    } else {
        f
    }
}

impl Tree {
    fn add(&mut self, name: String, data_value: Option<f64>, parent: Option<usize>) -> usize {
        let depth = parent.map_or(0, |p| self.nodes[p].depth + 1);
        let id = self.nodes.len();
        self.nodes.push(Node {
            name,
            data_value,
            value: 0.0,
            children: vec![],
            parent,
            depth,
            x0: 0.0,
            y0: 0.0,
            x1: 0.0,
            y1: 0.0,
        });
        if let Some(p) = parent {
            self.nodes[p].children.push(id);
        }
        id
    }

    /// Pre-order, children in order (`node.eachBefore`).
    fn pre_order(&self) -> Vec<usize> {
        let mut out = Vec::new();
        let mut stack = vec![0];
        while let Some(i) = stack.pop() {
            out.push(i);
            stack.extend(self.nodes[i].children.iter().rev());
        }
        out
    }

    /// `hierarchy.sum((d) => Math.max(0, d.value ?? 0))`: post-order, children added last to first.
    fn sum(&mut self) {
        for &i in self.pre_order().iter().rev() {
            let own = js_max(0.0, self.nodes[i].data_value.unwrap_or(0.0));
            let mut sum = if truthy(own) { own } else { 0.0 };
            for &c in self.nodes[i].children.iter().rev() {
                sum += self.nodes[c].value;
            }
            self.nodes[i].value = sum;
        }
    }

    /// `hierarchy.sort((a, b) => b.value - a.value)`: a stable sort of every child list.
    fn sort(&mut self) {
        for i in self.pre_order() {
            let mut kids = std::mem::take(&mut self.nodes[i].children);
            kids.sort_by(|&a, &b| {
                let d = self.nodes[b].value - self.nodes[a].value;
                d.partial_cmp(&0.0).unwrap_or(std::cmp::Ordering::Equal)
            });
            self.nodes[i].children = kids;
        }
    }

    fn set(&mut self, i: usize, x0: f64, y0: f64, x1: f64, y1: f64) {
        let n = &mut self.nodes[i];
        (n.x0, n.y0, n.x1, n.y1) = (x0, y0, x1, y1);
    }

    /// `treemapDice`: side by side along x.
    fn dice(&mut self, kids: &[usize], value: f64, x0: f64, y0: f64, x1: f64, y1: f64) {
        let k = if truthy(value) {
            (x1 - x0) / value
        } else {
            value
        };
        let mut x = x0;
        for &c in kids {
            let start = x;
            x += self.nodes[c].value * k;
            self.set(c, start, y0, x, y1);
        }
    }

    /// `treemapSlice`: stacked along y.
    fn slice(&mut self, kids: &[usize], value: f64, x0: f64, y0: f64, x1: f64, y1: f64) {
        let k = if truthy(value) {
            (y1 - y0) / value
        } else {
            value
        };
        let mut y = y0;
        for &c in kids {
            let start = y;
            y += self.nodes[c].value * k;
            self.set(c, x0, start, x1, y);
        }
    }

    /// `squarifyRatio(phi, parent, x0, y0, x1, y1)`.
    fn squarify(&mut self, parent: usize, mut x0: f64, mut y0: f64, x1: f64, y1: f64) {
        let ratio = (1.0 + 5f64.sqrt()) / 2.0;
        let kids = self.nodes[parent].children.clone();
        let v = |t: &Tree, i: usize| t.nodes[kids[i]].value;
        let n = kids.len();
        let mut value = self.nodes[parent].value;
        let (mut i0, mut i1) = (0, 0);
        while i0 < n {
            let (dx, dy) = (x1 - x0, y1 - y0);
            // Find the next non-empty node.
            let mut sum_value;
            loop {
                sum_value = v(self, i1);
                i1 += 1;
                if truthy(sum_value) || i1 >= n {
                    break;
                }
            }
            let (mut min_value, mut max_value) = (sum_value, sum_value);
            let alpha = js_max(dy / dx, dx / dy) / (value * ratio);
            let mut beta = sum_value * sum_value * alpha;
            let mut min_ratio = js_max(max_value / beta, beta / min_value);
            // Keep adding nodes while the aspect ratio maintains or improves.
            while i1 < n {
                let node_value = v(self, i1);
                sum_value += node_value;
                if node_value < min_value {
                    min_value = node_value;
                }
                if node_value > max_value {
                    max_value = node_value;
                }
                beta = sum_value * sum_value * alpha;
                let new_ratio = js_max(max_value / beta, beta / min_value);
                if new_ratio > min_ratio {
                    sum_value -= node_value;
                    break;
                }
                min_ratio = new_ratio;
                i1 += 1;
            }
            let row = &kids[i0..i1];
            if dx < dy {
                let start = y0;
                let end = if truthy(value) {
                    y0 += dy * sum_value / value;
                    y0
                } else {
                    y1
                };
                self.dice(row, sum_value, x0, start, x1, end);
            } else {
                let start = x0;
                let end = if truthy(value) {
                    x0 += dx * sum_value / value;
                    x0
                } else {
                    x1
                };
                self.slice(row, sum_value, start, y0, end, y1);
            }
            value -= sum_value;
            i0 = i1;
        }
    }

    /// `d3.treemap().size([w, h]).paddingInner(inner).paddingTop(top).round(true)(root)`.
    fn layout(&mut self, w: f64, h: f64, inner: f64, top: f64) {
        self.set(0, 0.0, 0.0, w, h);
        let mut padding_stack = vec![0.0];
        for i in self.pre_order() {
            let depth = self.nodes[i].depth;
            let p = padding_stack[depth];
            let n = &self.nodes[i];
            let (mut x0, mut y0, mut x1, mut y1) = (n.x0 + p, n.y0 + p, n.x1 - p, n.y1 - p);
            if x1 < x0 {
                x0 = (x0 + x1) / 2.0;
                x1 = x0;
            }
            if y1 < y0 {
                y0 = (y0 + y1) / 2.0;
                y1 = y0;
            }
            self.set(i, x0, y0, x1, y1);
            if !self.nodes[i].children.is_empty() {
                let p = inner / 2.0;
                padding_stack.truncate(depth + 1);
                padding_stack.push(p);
                x0 -= p;
                y0 += top - p;
                x1 += p;
                y1 += p;
                if x1 < x0 {
                    x0 = (x0 + x1) / 2.0;
                    x1 = x0;
                }
                if y1 < y0 {
                    y0 = (y0 + y1) / 2.0;
                    y1 = y0;
                }
                self.squarify(i, x0, y0, x1, y1);
            }
        }
        for n in &mut self.nodes {
            (n.x0, n.y0, n.x1, n.y1) = (
                js_round(n.x0),
                js_round(n.y0),
                js_round(n.x1),
                js_round(n.y1),
            );
        }
    }
}

static CLIP_IDS: AtomicU64 = AtomicU64::new(0);

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let how = c.aggregate(Agg::Sum);
    let fmt = c.fmt(".3~s");
    let height = c.height(240);
    let (w, h) = c.inner(
        height,
        crate::chart::Margin {
            top: 0.0,
            right: 0.0,
            bottom: 0.0,
            left: 0.0,
        },
    );
    let agg = |list: &[&Row]| {
        aggregate(
            &list.iter().map(|r| r.num(y_field)).collect::<Vec<_>>(),
            how,
        )
    };

    let mut tree = Tree { nodes: vec![] };
    let root = tree.add("root".into(), None, None);
    if let Some(s) = c.spec.series.as_deref() {
        for (name, list) in groups(c.rows, |r| r.text(s)) {
            let group = tree.add(name, None, Some(root));
            let owned: Vec<Row> = list.into_iter().cloned().collect();
            for (leaf, rows) in groups(&owned, |r| r.text(x_field)) {
                tree.add(leaf, Some(agg(&rows)), Some(group));
            }
        }
    } else {
        let entries: Vec<(String, f64)> = groups(c.rows, |r| r.text(x_field))
            .into_iter()
            .map(|(k, rows)| (k, agg(&rows)))
            .collect();
        for (name, value) in top_n(entries, c.spec.limit) {
            tree.add(name, Some(value), Some(root));
        }
    }

    let mut all_groups: Vec<String> = tree.nodes[root]
        .children
        .iter()
        .map(|&i| tree.nodes[i].name.clone())
        .collect();
    all_groups.sort_by(|a, b| by_name(a, b));
    tree.sum();
    tree.sort();
    tree.layout(w, h, 2.0, if c.spec.series.is_some() { 2.0 } else { 0.0 });

    let leaf_depth = if c.spec.series.is_some() { 2 } else { 1 };
    let colors = SeriesColors::new(c.theme, &all_groups);
    let leaves = tree
        .pre_order()
        .into_iter()
        .filter(|&i| tree.nodes[i].children.is_empty() && tree.nodes[i].depth == leaf_depth)
        .map(|i| {
            let n = &tree.nodes[i];
            let group = if c.spec.series.is_some() {
                &tree.nodes[n.parent.unwrap_or(0)].name
            } else {
                &n.name
            };
            let fill = colors.get(group);
            let (lw, lh) = (n.x1 - n.x0, n.y1 - n.y0);
            Leaf {
                transform: format!("translate({},{})", raw(n.x0), raw(n.y0)),
                width: raw(lw),
                height: raw(lh),
                fill,
                text_fill: text_on(c.theme, fill),
                clip_id: format!("d3s-clip-ssr{}", CLIP_IDS.fetch_add(1, Ordering::Relaxed)),
                label: if lw > 40.0 && lh > 20.0 {
                    format!("{} {}", n.name, fmt.format(n.value))
                } else {
                    String::new()
                },
            }
        })
        .collect::<Vec<_>>();

    let body = rsx::Template::render_to_string(views::treemap::Treemap {
        width: c.width,
        height,
        leaves: &leaves,
        radius: c.theme.radius.min(3.0),
    })?;
    Ok(Rendered {
        body,
        height,
        legend: all_groups
            .iter()
            .map(|k| LegendItem {
                key: k.clone(),
                color: colors.get(k).to_string(),
            })
            .collect(),
        force_legend: c.spec.series.is_some(),
        has_legend: true,
        ..Default::default()
    })
}
