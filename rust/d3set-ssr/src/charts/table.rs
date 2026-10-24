//! `table`: a sortable table, raw or grouped. Port of `charts/table.ts`.
//! The first render has no sort: lines keep data order, capped at `limit` (default 100).

use crate::agg::aggregate;
use crate::chart::{Ctx, Error, Rendered};
use crate::charts::toplist::{threshold_color, SELECTABLE};
use crate::format::Format;
use crate::spec::{Column, Threshold};
use crate::value::{Row, Value};
use crate::views;

/// `String(v ?? "")`: null and missing cells are empty.
pub(crate) fn cell_text(v: &Value) -> String {
    if v.is_null() {
        String::new()
    } else {
        v.to_string()
    }
}

/// A header cell, ready for the template.
pub struct Th {
    pub text: String,
    pub style: String,
}

/// A body cell, ready for the template.
pub struct Td {
    pub text: String,
    pub style: String,
    pub link: bool,
}

/// A body line, ready for the template. `style` is set in group mode (the line cross-filters).
pub struct Tr {
    pub cells: Vec<Td>,
    pub style: Option<&'static str>,
}

/// A column as the TS `ColumnSpec`, borrowed from the spec or built for group mode.
struct Col<'a> {
    field: String,
    label: Option<&'a str>,
    format: Option<&'a str>,
    align: Option<&'a str>,
    thresholds: &'a [Threshold],
}

impl<'a> From<&'a Column> for Col<'a> {
    fn from(c: &'a Column) -> Self {
        Col {
            field: c.field.clone(),
            label: c.label.as_deref(),
            format: c.format.as_deref(),
            align: c.align,
            thresholds: &c.thresholds,
        }
    }
}

fn plain(field: &str) -> Col<'static> {
    Col {
        field: field.to_string(),
        label: None,
        format: None,
        align: None,
        thresholds: &[],
    }
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    let spec = c.spec;
    let height = c.height(240);
    let limit = spec.limit.unwrap_or(100);
    let grouped = spec.x.is_some() && spec.aggregate.is_some();

    let (columns, lines): (Vec<Col>, Vec<Row>) = match (&spec.x, spec.aggregate) {
        (Some(x), Some(how)) => {
            let y = spec.y.as_deref().unwrap_or(x);
            let keys: Vec<&str> = std::iter::once(x.as_str())
                .chain(spec.series.as_deref())
                .collect();
            let metric = format!("{}({y})", how.name());
            let groups = crate::agg::groups(c.rows, |r| {
                keys.iter().map(|k| r.text(k)).collect::<Vec<_>>()
            });
            let lines = groups
                .into_iter()
                .map(|(parts, rs)| {
                    let value = aggregate(&rs.iter().map(|r| r.num(y)).collect::<Vec<_>>(), how);
                    // `{ ...Object.fromEntries(keys → parts), [metric]: value }`: a repeated field keeps its first place.
                    let mut row = Row::new();
                    for (k, p) in keys
                        .iter()
                        .zip(parts)
                        .chain(std::iter::once((&metric.as_str(), String::new())))
                    {
                        let v = if *k == metric {
                            Value::Num(value)
                        } else {
                            Value::Str(p)
                        };
                        match row.0.iter_mut().find(|(f, _)| f == k) {
                            Some(slot) => slot.1 = v,
                            None => row.0.push(((*k).to_string(), v)),
                        }
                    }
                    row
                })
                .collect();
            let columns = if spec.columns.is_empty() {
                keys.iter()
                    .map(|k| plain(k))
                    .chain(std::iter::once(Col {
                        field: metric.clone(),
                        label: None,
                        format: spec.format.as_deref(),
                        align: None,
                        thresholds: &spec.thresholds,
                    }))
                    .collect()
            } else {
                spec.columns.iter().map(Col::from).collect()
            };
            (columns, lines)
        }
        _ => {
            let columns = if spec.columns.is_empty() {
                c.rows
                    .first()
                    .map(|r| r.fields().map(plain).collect())
                    .unwrap_or_default()
            } else {
                spec.columns.iter().map(Col::from).collect()
            };
            (columns, c.rows.to_vec())
        }
    };

    let formats: Vec<Option<Format>> = columns
        .iter()
        .map(|col| col.format.map(Format::new))
        .collect();
    let numeric: Vec<bool> = columns
        .iter()
        .map(|col| {
            lines
                .iter()
                .any(|r| matches!(r.get(&col.field), Value::Num(_)))
        })
        .collect();
    let align = |i: usize| {
        columns[i]
            .align
            .unwrap_or(if numeric[i] { "right" } else { "left" })
    };

    let head = columns
        .iter()
        .enumerate()
        .map(|(i, col)| Th {
            text: col.label.unwrap_or(&col.field).to_string(),
            style: format!("text-align: {};", align(i)),
        })
        .collect::<Vec<_>>();
    let body = lines
        .iter()
        .take(limit)
        .map(|r| {
            let cells = columns
                .iter()
                .enumerate()
                .map(|(i, col)| {
                    let v = r.get(&col.field);
                    let text = match (v, &formats[i]) {
                        (Value::Num(n), Some(f)) => f.format(*n),
                        _ => cell_text(v),
                    };
                    let mut style = format!("text-align: {};", align(i));
                    if let Value::Num(n) = v {
                        if let Some(t) = col.thresholds.iter().find(|t| t.matches(*n)) {
                            style.push_str(&format!(
                                " color: {}; font-weight: 600;",
                                threshold_color(c.theme, t)
                            ));
                        }
                    }
                    let link = !grouped && !numeric[i] && !v.is_null();
                    if link {
                        style.push(' ');
                        style.push_str(SELECTABLE);
                    }
                    Td { text, style, link }
                })
                .collect();
            Tr {
                cells,
                style: grouped.then_some(SELECTABLE),
            }
        })
        .collect::<Vec<_>>();

    let body = rsx::Template::render_to_string(views::table::Table {
        head: &head,
        rows: &body,
    })?;
    Ok(Rendered {
        body,
        height,
        ..Default::default()
    })
}
