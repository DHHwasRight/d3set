//! The chart contract: a spec and rows in, the markup of one chart out.

use crate::format::Format;
use crate::spec::{Agg, Spec};
use crate::theme::Theme;
use crate::value::Row;

/// What can go wrong: a spec that misses a field its type needs, an unknown type, or a template error.
#[derive(Debug)]
pub struct Error(pub String);

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for Error {}

impl From<rsx::Error> for Error {
    fn from(e: rsx::Error) -> Self {
        Error(format!("d3set: template error: {e}"))
    }
}

/// Space around the plot, as `margin` in the TypeScript library.
#[derive(Clone, Copy, Debug)]
pub struct Margin {
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
    pub left: f64,
}

pub const MARGIN: Margin = Margin {
    top: 8.0,
    right: 12.0,
    bottom: 24.0,
    left: 44.0,
};

/// Everything a chart reads.
pub struct Ctx<'a> {
    pub spec: &'a Spec,
    pub rows: &'a [Row],
    pub theme: &'a Theme,
    /// Width in CSS pixels. The server cannot measure the page, so the caller says how wide the card is.
    pub width: f64,
}

impl Ctx<'_> {
    /// A field the chart type needs, with the TypeScript library's error message.
    pub fn need(&self, field: &str) -> Result<&str, Error> {
        let v = match field {
            "x" => self.spec.x.as_deref(),
            "y" => self.spec.y.as_deref(),
            "series" => self.spec.series.as_deref(),
            _ => None,
        };
        v.ok_or_else(|| {
            Error(format!(
                "d3set: chart type '{}' requires field '{field}'.",
                self.spec.kind
            ))
        })
    }

    pub fn height(&self, default: u32) -> f64 {
        f64::from(self.spec.height.unwrap_or(default))
    }

    pub fn fmt(&self, default: &str) -> Format {
        Format::new(self.spec.format.as_deref().unwrap_or(default))
    }

    pub fn aggregate(&self, default: Agg) -> Agg {
        self.spec.aggregate.unwrap_or(default)
    }

    /// Plot size inside a margin.
    pub fn inner(&self, height: f64, m: Margin) -> (f64, f64) {
        (
            (self.width - m.left - m.right).max(0.0),
            (height - m.top - m.bottom).max(0.0),
        )
    }

    /// The series key of a row: the `series` field, or the `y` field name for a single series.
    pub fn series_of(&self, r: &Row, y: &str) -> String {
        match &self.spec.series {
            Some(s) => r.text(s),
            None => y.to_string(),
        }
    }
}

/// One legend entry.
#[derive(Clone, Debug)]
pub struct LegendItem {
    pub key: String,
    pub color: String,
}

/// A rendered chart: the inside of the chart element, and what goes on and after it.
#[derive(Debug, Default)]
pub struct Rendered {
    /// Markup inside the `.d3s-chart` element.
    pub body: String,
    /// Extra classes on the chart element, for example `d3s-kpi`.
    pub class: &'static str,
    /// Extra inline style on the chart element, after the height.
    pub style: String,
    pub height: f64,
    pub legend: Vec<LegendItem>,
    /// Show the legend even with one key (pie, donut, sunburst).
    pub force_legend: bool,
    /// The chart has a legend element even with no keys, like a TS chart that calls `createLegend`.
    pub has_legend: bool,
    /// The element is not a `.d3s-chart` and has no fixed height (note).
    pub plain: bool,
}

impl Rendered {
    /// The chart element and its legend, as the browser has them before hydration.
    pub fn html(&self) -> Result<String, Error> {
        Ok(rsx::Template::render_to_string(
            crate::views::frame::ChartElement { chart: self },
        )?)
    }
}

/// Render one chart.
pub fn render(spec: &Spec, rows: &[Row], theme: &Theme, width: f64) -> Result<Rendered, Error> {
    let ctx = Ctx {
        spec,
        rows,
        theme,
        width,
    };
    crate::charts::render(&ctx)
}
