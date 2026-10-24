//! Grouping and aggregation, with d3's semantics: groups keep first-seen order.

use crate::spec::Agg;
use crate::value::Row;

pub fn aggregate(values: &[f64], how: Agg) -> f64 {
    let finite = || values.iter().copied().filter(|v| !v.is_nan());
    match how {
        Agg::Sum => finite().sum(),
        Agg::Count => values.len() as f64,
        Agg::Avg => {
            let n = finite().count();
            if n == 0 {
                0.0
            } else {
                finite().sum::<f64>() / n as f64
            }
        }
        Agg::Min => finite().reduce(f64::min).unwrap_or(0.0),
        Agg::Max => finite().reduce(f64::max).unwrap_or(0.0),
        Agg::Last => values.last().copied().unwrap_or(0.0),
    }
}

/// `d3.groups(rows, key)`: groups in first-seen order.
pub fn groups<K: PartialEq + Clone>(rows: &[Row], key: impl Fn(&Row) -> K) -> Vec<(K, Vec<&Row>)> {
    let mut out: Vec<(K, Vec<&Row>)> = Vec::new();
    for r in rows {
        let k = key(r);
        match out.iter_mut().find(|(g, _)| *g == k) {
            Some((_, list)) => list.push(r),
            None => out.push((k, vec![r])),
        }
    }
    out
}

/// `d3.rollups(rows, v => aggregate(v.map(r => Number(r[field])), how), key)`.
pub fn rollup(
    rows: &[Row],
    key: impl Fn(&Row) -> String,
    field: &str,
    how: Agg,
) -> Vec<(String, f64)> {
    groups(rows, key)
        .into_iter()
        .map(|(k, list)| {
            let values: Vec<f64> = list.iter().map(|r| r.num(field)).collect();
            (k, aggregate(&values, how))
        })
        .collect()
}

/// Natural order for labels: `host-2` before `host-10`, like `localeCompare(…, { numeric: true })`.
pub fn by_name(a: &str, b: &str) -> std::cmp::Ordering {
    let (mut x, mut y) = (a.chars().peekable(), b.chars().peekable());
    loop {
        match (x.peek().copied(), y.peek().copied()) {
            (None, None) => return std::cmp::Ordering::Equal,
            (None, _) => return std::cmp::Ordering::Less,
            (_, None) => return std::cmp::Ordering::Greater,
            (Some(c), Some(d)) if c.is_ascii_digit() && d.is_ascii_digit() => {
                let mut n = String::new();
                while let Some(c) = x.peek().copied().filter(char::is_ascii_digit) {
                    n.push(c);
                    x.next();
                }
                let mut m = String::new();
                while let Some(d) = y.peek().copied().filter(char::is_ascii_digit) {
                    m.push(d);
                    y.next();
                }
                let ord = n
                    .trim_start_matches('0')
                    .len()
                    .cmp(&m.trim_start_matches('0').len())
                    .then(n.cmp(&m));
                if ord.is_ne() {
                    return ord;
                }
            }
            (Some(c), Some(d)) => {
                let ord = c.to_lowercase().cmp(d.to_lowercase()).then(c.cmp(&d));
                if ord.is_ne() {
                    return ord;
                }
                x.next();
                y.next();
            }
        }
    }
}

/// Keep the `limit` largest entries; the rest become one "Other" entry.
pub fn top_n(entries: Vec<(String, f64)>, limit: Option<usize>) -> Vec<(String, f64)> {
    let Some(limit) = limit.filter(|&l| l > 0 && entries.len() > l) else {
        return entries;
    };
    let mut sorted = entries;
    sorted.sort_by(|a, b| b.1.total_cmp(&a.1));
    let rest: f64 = sorted[limit - 1..].iter().map(|e| e.1).sum();
    sorted.truncate(limit - 1);
    sorted.push(("Other".to_string(), rest));
    sorted
}

/// `d3.extent`, ignoring NaN.
pub fn extent(values: impl IntoIterator<Item = f64>) -> Option<[f64; 2]> {
    values
        .into_iter()
        .filter(|v| !v.is_nan())
        .fold(None, |acc, v| match acc {
            None => Some([v, v]),
            Some([lo, hi]) => Some([lo.min(v), hi.max(v)]),
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn natural_order() {
        let mut v = vec!["host-10", "host-2", "Host-1", "api"];
        v.sort_by(|a, b| by_name(a, b));
        assert_eq!(v, ["api", "Host-1", "host-2", "host-10"]);
    }

    #[test]
    fn other_groups_the_rest() {
        let e = vec![
            ("a".into(), 5.0),
            ("b".into(), 1.0),
            ("c".into(), 9.0),
            ("d".into(), 2.0),
        ];
        assert_eq!(
            top_n(e, Some(3)),
            vec![("c".into(), 9.0), ("a".into(), 5.0), ("Other".into(), 3.0)]
        );
    }
}
