//! Render charts from JSON, for the parity test in `test/ssr-parity.test.ts`.
//!
//! Reads `[{ "spec": {...}, "rows": [...], "width": 400, "theme": "light" }, ...]` on stdin and
//! writes a JSON array of `{ "html": "..." }` or `{ "error": "..." }`, one per case.

use std::io::Read;

use d3set_ssr::spec::{Column, Level, Objective, Threshold};
use d3set_ssr::{Agg, Row, Spec, Value, DARK, LIGHT};
use serde_json::Value as J;

fn s(j: &J, k: &str) -> Option<String> {
    j.get(k).and_then(J::as_str).map(str::to_string)
}
fn f(j: &J, k: &str) -> Option<f64> {
    j.get(k).and_then(J::as_f64)
}
fn leak(s: &str) -> &'static str {
    Box::leak(s.to_string().into_boxed_str())
}

fn threshold(t: &J) -> Threshold {
    Threshold {
        op: leak(t["op"].as_str().unwrap_or(">")),
        value: t["value"].as_f64().unwrap_or(0.0),
        level: t.get("level").and_then(J::as_str).and_then(Level::parse),
        color: s(t, "color"),
        label: s(t, "label"),
    }
}

fn spec(j: &J) -> Spec {
    let agg = s(j, "aggregate").map(|a| match a.as_str() {
        "count" => Agg::Count,
        "avg" => Agg::Avg,
        "min" => Agg::Min,
        "max" => Agg::Max,
        "last" => Agg::Last,
        _ => Agg::Sum,
    });
    let list = |k: &str| j.get(k).and_then(J::as_array).cloned().unwrap_or_default();
    Spec {
        kind: s(j, "type").unwrap_or_default(),
        title: s(j, "title"),
        x: s(j, "x"),
        y: s(j, "y"),
        series: s(j, "series"),
        aggregate: agg,
        format: s(j, "format"),
        height: f(j, "height").map(|v| v as u32),
        span: f(j, "span").map(|v| v as u8),
        interval: s(j, "interval"),
        display: s(j, "display").map(|d| leak(&d)),
        thresholds: list("thresholds").iter().map(threshold).collect(),
        size: s(j, "size"),
        stacked: j.get("stacked").and_then(J::as_bool),
        horizontal: j.get("horizontal").and_then(J::as_bool),
        columns: list("columns")
            .iter()
            .map(|c| Column {
                field: s(c, "field").unwrap_or_default(),
                label: s(c, "label"),
                format: s(c, "format"),
                align: s(c, "align").map(|a| leak(&a)),
                thresholds: c
                    .get("thresholds")
                    .and_then(J::as_array)
                    .map(|t| t.iter().map(threshold).collect())
                    .unwrap_or_default(),
            })
            .collect(),
        limit: f(j, "limit").map(|v| v as usize),
        bins: f(j, "bins").map(|v| v as usize),
        min: f(j, "min"),
        max: f(j, "max"),
        inner_radius: f(j, "innerRadius"),
        objective: j.get("objective").map(|o| Objective {
            good_op: leak(o["good"]["op"].as_str().unwrap_or("<=")),
            good_value: o["good"]["value"].as_f64().unwrap_or(0.0),
            target: o["target"].as_f64().unwrap_or(99.0),
        }),
        window: s(j, "window"),
        decrease_is_good: j.get("decreaseIsGood").and_then(J::as_bool),
        text: s(j, "text"),
        options: j
            .get("options")
            .and_then(J::as_object)
            .map(|o| o.iter().map(|(k, v)| (k.clone(), value(v))).collect())
            .unwrap_or_default(),
    }
}

fn value(v: &J) -> Value {
    match v {
        J::Null => Value::Null,
        J::Bool(b) => Value::Bool(*b),
        J::Number(n) => Value::Num(n.as_f64().unwrap_or(f64::NAN)),
        J::String(s) => Value::Str(s.clone()),
        other => Value::Str(other.to_string()),
    }
}

fn row(j: &J) -> Row {
    Row(j
        .as_object()
        .map(|o| o.iter().map(|(k, v)| (k.clone(), value(v))).collect())
        .unwrap_or_default())
}

fn main() {
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input).expect("stdin");
    let cases: Vec<J> = serde_json::from_str(&input).expect("a JSON array of cases");
    let out: Vec<J> = cases
        .iter()
        .map(|c| {
            let rows: Vec<Row> = c["rows"]
                .as_array()
                .map(|a| a.iter().map(row).collect())
                .unwrap_or_default();
            let theme = if c["theme"] == "dark" { &DARK } else { &LIGHT };
            let width = c["width"].as_f64().unwrap_or(400.0);
            match d3set_ssr::render(&spec(&c["spec"]), &rows, theme, width).and_then(|r| r.html()) {
                Ok(html) => serde_json::json!({ "html": html }),
                Err(e) => serde_json::json!({ "error": e.to_string() }),
            }
        })
        .collect();
    println!("{}", serde_json::to_string(&out).expect("json"));
}
