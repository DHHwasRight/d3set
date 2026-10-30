//! The chart spec: the same fields as the TypeScript `ChartSpec`, built with chained setters.

use crate::value::Value;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Agg {
    Sum,
    Count,
    Avg,
    Min,
    Max,
    Last,
}

impl Agg {
    pub fn name(self) -> &'static str {
        match self {
            Agg::Sum => "sum",
            Agg::Count => "count",
            Agg::Avg => "avg",
            Agg::Min => "min",
            Agg::Max => "max",
            Agg::Last => "last",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Level {
    Ok,
    Warning,
    Critical,
}

impl Level {
    pub fn name(self) -> &'static str {
        match self {
            Level::Ok => "ok",
            Level::Warning => "warning",
            Level::Critical => "critical",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "ok" => Some(Level::Ok),
            "warning" => Some(Level::Warning),
            "critical" => Some(Level::Critical),
            _ => None,
        }
    }
}

/// A conditional format rule. The first matching rule wins.
#[derive(Clone, Debug)]
pub struct Threshold {
    /// One of `>`, `>=`, `<`, `<=`, `=`.
    pub op: &'static str,
    pub value: f64,
    pub level: Option<Level>,
    pub color: Option<String>,
    pub label: Option<String>,
}

impl Threshold {
    pub fn new(op: &'static str, value: f64, level: Level) -> Self {
        Self {
            op,
            value,
            level: Some(level),
            color: None,
            label: None,
        }
    }

    pub fn matches(&self, v: f64) -> bool {
        match self.op {
            ">" => v > self.value,
            ">=" => v >= self.value,
            "<" => v < self.value,
            "<=" => v <= self.value,
            "=" => v == self.value,
            _ => false,
        }
    }
}

#[derive(Clone, Debug)]
pub struct Column {
    pub field: String,
    pub label: Option<String>,
    pub format: Option<String>,
    pub align: Option<&'static str>,
    pub thresholds: Vec<Threshold>,
}

impl Column {
    pub fn new(field: &str) -> Self {
        Self {
            field: field.into(),
            label: None,
            format: None,
            align: None,
            thresholds: vec![],
        }
    }
    #[must_use]
    pub fn label(mut self, l: &str) -> Self {
        self.label = Some(l.into());
        self
    }
    #[must_use]
    pub fn format(mut self, f: &str) -> Self {
        self.format = Some(f.into());
        self
    }
}

#[derive(Clone, Debug)]
pub struct Objective {
    pub good_op: &'static str,
    pub good_value: f64,
    pub target: f64,
}

#[derive(Clone, Debug, Default)]
pub struct Spec {
    pub kind: String,
    pub title: Option<String>,
    pub x: Option<String>,
    pub y: Option<String>,
    pub series: Option<String>,
    pub aggregate: Option<Agg>,
    pub format: Option<String>,
    pub height: Option<u32>,
    pub span: Option<u8>,
    pub interval: Option<String>,
    pub display: Option<&'static str>,
    pub thresholds: Vec<Threshold>,
    pub size: Option<String>,
    pub stacked: Option<bool>,
    pub horizontal: Option<bool>,
    pub columns: Vec<Column>,
    pub limit: Option<usize>,
    pub bins: Option<usize>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub inner_radius: Option<f64>,
    pub objective: Option<Objective>,
    pub window: Option<String>,
    pub decrease_is_good: Option<bool>,
    pub text: Option<String>,
    /// Extra options, as in `spec.options` (`sort`, `ascending`).
    pub options: Vec<(String, Value)>,
}

macro_rules! setters {
    ($($name:ident: $ty:ty => $conv:expr),* $(,)?) => {
        $(
            #[must_use]
            pub fn $name(mut self, v: $ty) -> Self {
                self.$name = Some($conv(v));
                self
            }
        )*
    };
}

impl Spec {
    pub fn new(kind: &str) -> Self {
        Self {
            kind: kind.into(),
            ..Default::default()
        }
    }

    setters! {
        title: &str => String::from,
        x: &str => String::from,
        y: &str => String::from,
        series: &str => String::from,
        aggregate: Agg => std::convert::identity,
        format: &str => String::from,
        height: u32 => std::convert::identity,
        span: u8 => std::convert::identity,
        interval: &str => String::from,
        display: &'static str => std::convert::identity,
        size: &str => String::from,
        stacked: bool => std::convert::identity,
        horizontal: bool => std::convert::identity,
        limit: usize => std::convert::identity,
        bins: usize => std::convert::identity,
        min: f64 => std::convert::identity,
        max: f64 => std::convert::identity,
        inner_radius: f64 => std::convert::identity,
        window: &str => String::from,
        decrease_is_good: bool => std::convert::identity,
        text: &str => String::from,
    }

    #[must_use]
    pub fn thresholds(mut self, t: Vec<Threshold>) -> Self {
        self.thresholds = t;
        self
    }

    #[must_use]
    pub fn columns(mut self, c: Vec<Column>) -> Self {
        self.columns = c;
        self
    }

    #[must_use]
    pub fn objective(mut self, good_op: &'static str, good_value: f64, target: f64) -> Self {
        self.objective = Some(Objective {
            good_op,
            good_value,
            target,
        });
        self
    }

    #[must_use]
    pub fn option(mut self, key: &str, v: impl Into<Value>) -> Self {
        self.options.push((key.into(), v.into()));
        self
    }

    /// An option as text: `typeof options.key === "string"`.
    pub fn option_str(&self, key: &str) -> Option<&str> {
        self.options
            .iter()
            .find(|(k, _)| k == key)
            .and_then(|(_, v)| v.as_str())
    }

    /// An option as a boolean: `options.sort === true`.
    pub fn flag(&self, key: &str) -> bool {
        self.options
            .iter()
            .any(|(k, v)| k == key && *v == Value::Bool(true))
    }
}
