//! `hostmap`: one hexagon per `x` value, colored by the aggregate of `y` (default `last`),
//! grouped by `series`. Port of `charts/hostmap.ts`.

use std::cmp::Ordering;

use crate::agg::{aggregate, groups};
use crate::chart::{Ctx, Error, Rendered};
use crate::charts::toplist::{value_color, SELECTABLE};
use crate::color::{interpolate_lab, sequential, text_on};
use crate::spec::Agg;
use crate::value::Row;
use crate::views;

/// Rank of a character class in the ICU root collation: spaces and punctuation, digits, then letters.
fn class(c: char) -> u8 {
    if c.is_ascii_digit() {
        1
    } else if c.is_alphabetic() {
        2
    } else {
        0
    }
}

/// `a.localeCompare(b, undefined, { numeric })` as ICU (Node, browsers) does it for plain labels:
/// letters compare without case first, and only a full tie looks at case (lowercase first).
/// `agg::by_name` breaks case ties at the first differing letter and puts uppercase first, so
/// `"aB"` and `"Ab"` come out in the other order there.
pub(crate) fn collate(a: &str, b: &str, numeric: bool) -> Ordering {
    primary(a, b, numeric).then_with(|| {
        // Tertiary level: the first case difference decides, lowercase first.
        for (x, y) in a.chars().zip(b.chars()) {
            if x != y && x.to_lowercase().eq(y.to_lowercase()) {
                return if x.is_lowercase() {
                    Ordering::Less
                } else {
                    Ordering::Greater
                };
            }
        }
        a.cmp(b)
    })
}

fn primary(a: &str, b: &str, numeric: bool) -> Ordering {
    let (mut x, mut y) = (a.chars().peekable(), b.chars().peekable());
    loop {
        match (x.peek().copied(), y.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, _) => return Ordering::Less,
            (_, None) => return Ordering::Greater,
            (Some(c), Some(d)) if numeric && c.is_ascii_digit() && d.is_ascii_digit() => {
                let take = |it: &mut std::iter::Peekable<std::str::Chars>| {
                    let mut s = String::new();
                    while let Some(c) = it.peek().copied().filter(char::is_ascii_digit) {
                        s.push(c);
                        it.next();
                    }
                    s.trim_start_matches('0').to_string()
                };
                let (n, m) = (take(&mut x), take(&mut y));
                let ord = n.len().cmp(&m.len()).then(n.cmp(&m));
                if ord.is_ne() {
                    return ord;
                }
            }
            (Some(c), Some(d)) => {
                let (lc, ld) = (
                    c.to_lowercase().next().unwrap_or(c),
                    d.to_lowercase().next().unwrap_or(d),
                );
                let ord = class(c).cmp(&class(d)).then(lc.cmp(&ld));
                if ord.is_ne() {
                    return ord;
                }
                x.next();
                y.next();
            }
        }
    }
}

/// `d3.scaleSequential(interpolateLab(...)).domain(domain)(x)`. d3 uses the middle color (t = 0.5)
/// when the domain is one value; `color::sequential` uses t = 0 there, so that case is handled here.
fn seq_color(c: &Ctx, domain: [f64; 2], x: f64) -> String {
    if domain[0] == domain[1] {
        interpolate_lab(c.theme.sequential[0], c.theme.sequential[1], 0.5).css()
    } else {
        sequential(c.theme, domain, x)
    }
}

/// One hexagon, ready for the template.
pub struct Hex {
    pub title: String,
    pub style: String,
}

/// One group of hexagons. `title` is set when `series` groups them.
pub struct HexGroup {
    pub title: Option<String>,
    pub tiles: Vec<Hex>,
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let fmt = c.fmt(".3~s");
    let height = c.height(240);
    let how = c.aggregate(Agg::Last);
    // `d3.rollups(rows, agg, x)` in natural name order.
    let by_x = |rows: &[&Row]| -> Vec<(String, f64)> {
        let mut list: Vec<(String, Vec<f64>)> = Vec::new();
        for r in rows {
            let k = r.text(x_field);
            match list.iter_mut().find(|(g, _)| *g == k) {
                Some((_, v)) => v.push(r.num(y_field)),
                None => list.push((k, vec![r.num(y_field)])),
            }
        }
        let mut list: Vec<(String, f64)> = list
            .into_iter()
            .map(|(k, v)| (k, aggregate(&v, how)))
            .collect();
        list.sort_by(|a, b| collate(&a.0, &b.0, true));
        list
    };
    let grouped: Vec<(String, Vec<(String, f64)>)> = match &c.spec.series {
        Some(s) => {
            let mut g: Vec<(String, Vec<(String, f64)>)> = groups(c.rows, |r| r.text(s))
                .into_iter()
                .map(|(k, rs)| (k, by_x(&rs)))
                .collect();
            g.sort_by(|a, b| collate(&a.0, &b.0, false));
            g
        }
        None => vec![(String::new(), by_x(&c.rows.iter().collect::<Vec<_>>()))],
    };

    let all = grouped
        .iter()
        .flat_map(|(_, l)| l.iter().map(|e| e.1))
        .filter(|v| !v.is_nan());
    let domain = all.fold(None, |acc: Option<[f64; 2]>, v| {
        Some(acc.map_or([v, v], |[lo, hi]| [lo.min(v), hi.max(v)]))
    });
    let domain = domain.unwrap_or([0.0, 1.0]);
    let groups = grouped
        .iter()
        .map(|(g, list)| HexGroup {
            title: c.spec.series.as_ref().map(|_| g.clone()),
            tiles: list
                .iter()
                .map(|(name, v)| {
                    // Thresholds replace the color scale. NaN has no color on the scale (d3's `unknown`).
                    let fill = if c.spec.thresholds.is_empty() {
                        if v.is_nan() {
                            String::new()
                        } else {
                            seq_color(c, domain, *v)
                        }
                    } else {
                        value_color(c.theme, *v, &c.spec.thresholds, c.theme.positive)
                    };
                    let color = if fill.is_empty() {
                        "#fff"
                    } else {
                        text_on(&fill)
                    };
                    Hex {
                        title: format!("{name}: {}", fmt.format(*v)),
                        style: format!("background: {fill}; color: {color}; {SELECTABLE}"),
                    }
                })
                .collect(),
        })
        .collect::<Vec<_>>();

    let body = rsx::Template::render_to_string(views::hostmap::Hostmap { groups: &groups })?;
    Ok(Rendered {
        body,
        height,
        ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use super::collate;
    use std::cmp::Ordering;

    #[test]
    fn collates_like_icu() {
        let mut v = vec!["host-10", "host-2", "Host-1", "api", "aB", "Ab"];
        v.sort_by(|a, b| collate(a, b, true));
        assert_eq!(v, ["aB", "Ab", "api", "Host-1", "host-2", "host-10"]);
        assert_eq!(collate("x10", "x9", false), Ordering::Less);
        assert_eq!(collate("a", "A", false), Ordering::Less);
    }
}
