//! Rows: the same shape as the TypeScript `Row`, a record of named cells.

use std::fmt;

/// One cell. Dates are ISO 8601 strings, as they arrive in JSON.
#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
}

impl Value {
    /// The cell as a number, like JavaScript's `Number(cell)`: strings parse, the rest is NaN.
    pub fn num(&self) -> f64 {
        match self {
            Value::Num(n) => *n,
            Value::Bool(b) => f64::from(u8::from(*b)),
            Value::Str(s) => s.trim().parse().unwrap_or(f64::NAN),
            Value::Null => f64::NAN,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::Str(s) => Some(s),
            _ => None,
        }
    }

    pub fn is_null(&self) -> bool {
        matches!(self, Value::Null)
    }
}

/// `String(cell)` in JavaScript: what a category label is.
impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Value::Null => f.write_str("null"),
            Value::Bool(b) => write!(f, "{b}"),
            Value::Num(n) => f.write_str(&crate::format::js_number(*n)),
            Value::Str(s) => f.write_str(s),
        }
    }
}

impl From<&str> for Value {
    fn from(s: &str) -> Self {
        Value::Str(s.to_string())
    }
}
impl From<String> for Value {
    fn from(s: String) -> Self {
        Value::Str(s)
    }
}
impl From<f64> for Value {
    fn from(n: f64) -> Self {
        Value::Num(n)
    }
}
impl From<i64> for Value {
    fn from(n: i64) -> Self {
        Value::Num(n as f64)
    }
}
impl From<u32> for Value {
    fn from(n: u32) -> Self {
        Value::Num(f64::from(n))
    }
}
impl From<bool> for Value {
    fn from(b: bool) -> Self {
        Value::Bool(b)
    }
}

impl jt::ToJson for Value {
    fn to_json<O: jt::Out + ?Sized>(&self, out: &mut O) {
        match self {
            Value::Null => ().to_json(out),
            Value::Bool(b) => b.to_json(out),
            Value::Num(n) => n.to_json(out),
            Value::Str(s) => s.to_json(out),
        }
    }
}

/// A record. Field order is kept: a table without `columns` shows the fields of its first row in order.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Row(pub Vec<(String, Value)>);

static NULL: Value = Value::Null;

impl Row {
    pub fn new() -> Self {
        Self(Vec::new())
    }

    /// Add a field, builder style.
    #[must_use]
    pub fn with(mut self, field: &str, value: impl Into<Value>) -> Self {
        self.0.push((field.to_string(), value.into()));
        self
    }

    /// A cell, or `Null` when the row has no such field.
    pub fn get(&self, field: &str) -> &Value {
        self.0
            .iter()
            .find(|(k, _)| k == field)
            .map_or(&NULL, |(_, v)| v)
    }

    /// `String(row[field])`, the key used for categories.
    pub fn text(&self, field: &str) -> String {
        self.get(field).to_string()
    }

    pub fn num(&self, field: &str) -> f64 {
        self.get(field).num()
    }

    pub fn fields(&self) -> impl Iterator<Item = &str> {
        self.0.iter().map(|(k, _)| k.as_str())
    }
}

impl jt::ToJson for Row {
    fn to_json<O: jt::Out + ?Sized>(&self, out: &mut O) {
        crate::payload::RowJson(self).to_json(out);
    }
}
