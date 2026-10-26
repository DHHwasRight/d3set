//! A dashboard and a single figure: server markup plus the payload `hydrate()` reads.

use crate::chart::{Error, Rendered};
use crate::payload::{script_safe, ChartJson, DashboardJson};
use crate::spec::Spec;
use crate::theme::{Theme, LIGHT};
use crate::value::Row;

/// A filter in the dashboard filter bar. The same kinds as the TypeScript builders.
#[derive(Clone, Debug)]
pub enum Filter {
    Select {
        field: String,
        label: String,
        multiple: bool,
        options: Option<Vec<String>>,
    },
    Range {
        field: String,
        label: String,
        min: Option<f64>,
        max: Option<f64>,
    },
    Search {
        field: String,
        label: String,
    },
    DateRange {
        field: String,
        label: String,
    },
}

fn title_case(field: &str) -> String {
    let mut c = field.chars();
    c.next().map_or_else(String::new, |f| {
        f.to_uppercase().collect::<String>() + c.as_str()
    })
}

impl Filter {
    pub fn select(field: &str) -> Self {
        Filter::Select {
            field: field.into(),
            label: title_case(field),
            multiple: false,
            options: None,
        }
    }
    pub fn multi_select(field: &str) -> Self {
        Filter::Select {
            field: field.into(),
            label: title_case(field),
            multiple: true,
            options: None,
        }
    }
    pub fn range(field: &str) -> Self {
        Filter::Range {
            field: field.into(),
            label: title_case(field),
            min: None,
            max: None,
        }
    }
    pub fn search(field: &str) -> Self {
        Filter::Search {
            field: field.into(),
            label: title_case(field),
        }
    }
    pub fn date_range(field: &str) -> Self {
        Filter::DateRange {
            field: field.into(),
            label: title_case(field),
        }
    }

    /// Fixed options for a select. Without them, options come from the data.
    #[must_use]
    pub fn options(mut self, values: &[&str]) -> Self {
        if let Filter::Select { options, .. } = &mut self {
            *options = Some(values.iter().map(|s| s.to_string()).collect());
        }
        self
    }

    pub fn field(&self) -> &str {
        match self {
            Filter::Select { field, .. }
            | Filter::Range { field, .. }
            | Filter::Search { field, .. }
            | Filter::DateRange { field, .. } => field,
        }
    }
    pub fn id(&self) -> &str {
        self.field()
    }
    pub fn label(&self) -> &str {
        match self {
            Filter::Select { label, .. }
            | Filter::Range { label, .. }
            | Filter::Search { label, .. }
            | Filter::DateRange { label, .. } => label,
        }
    }

    /// Options shown by the server: fixed ones, or distinct values in name order.
    pub fn option_values(&self, rows: &[Row]) -> Vec<String> {
        match self {
            Filter::Select {
                options: Some(o), ..
            } => o.clone(),
            _ => {
                let mut v: Vec<String> = Vec::new();
                for r in rows {
                    let cell = r.get(self.field());
                    if !cell.is_null() {
                        let s = cell.to_string();
                        if !v.contains(&s) {
                            v.push(s);
                        }
                    }
                }
                v.sort_by(|a, b| crate::agg::by_name(a, b));
                v
            }
        }
    }
}

/// A live data source for hydrated charts: server-sent events at `url`.
#[derive(Clone, Debug)]
pub struct Stream {
    pub url: String,
    /// Keep only the newest rows.
    pub max_rows: Option<usize>,
    /// Row identity field. With it, rows that arrive twice (a reconnect replaying a catch-up) replace
    /// themselves instead of counting twice.
    pub key: Option<String>,
}

impl Stream {
    pub fn new(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            max_rows: None,
            key: None,
        }
    }
    #[must_use]
    pub fn max_rows(mut self, n: usize) -> Self {
        self.max_rows = Some(n);
        self
    }
    #[must_use]
    pub fn key(mut self, field: &str) -> Self {
        self.key = Some(field.into());
        self
    }
}

/// A dashboard: charts that share one data source, filters, and a time window.
pub struct Dashboard {
    pub charts: Vec<Spec>,
    pub filters: Vec<Filter>,
    pub time_field: Option<String>,
    pub time_window: Option<String>,
    /// Live data. Without it, the page hydrates with the embedded rows only.
    pub stream: Option<Stream>,
    pub filter_mode: Option<&'static str>,
    pub theme: &'static Theme,
    /// Width of the dashboard in CSS pixels, to size the cards like the CSS grid will.
    pub width: f64,
}

impl Default for Dashboard {
    fn default() -> Self {
        Self {
            charts: vec![],
            filters: vec![],
            time_field: None,
            time_window: None,
            stream: None,
            filter_mode: None,
            theme: &LIGHT,
            width: 960.0,
        }
    }
}

/// A rendered card, for the template.
pub struct Card {
    pub title: Option<String>,
    pub span: u8,
    pub chart: Rendered,
}

/// Columns and card width of `.d3s-grid`: `repeat(auto-fill, minmax(min(100%, 320px), 1fr))`,
/// with `gap` between cards (the theme's `space_md`, as the CSS uses).
pub fn grid(width: f64, gap: f64) -> (usize, f64) {
    let columns = (((width + gap) / (320.0 + gap)).floor() as usize).max(1);
    (
        columns,
        (width - gap * (columns as f64 - 1.0)) / columns as f64,
    )
}

/// Width of a chart inside a card that spans `span` columns. The grid gap and the card padding
/// are both `space` (the theme's `space_md`, `--d3s-space-md` in the CSS).
pub fn chart_width(width: f64, span: u8, space: f64) -> f64 {
    let (columns, card) = grid(width, space);
    let span = usize::from(span.max(1)).min(columns) as f64;
    card * span + space * (span - 1.0) - 2.0 * space
}

impl Dashboard {
    /// The whole dashboard: markup for every chart, and the payload for `hydrate()`.
    /// `rows` are the rows the charts show now; the payload carries them so the browser starts from the same data.
    pub fn render(&self, rows: &[Row]) -> Result<String, Error> {
        let cards = self
            .charts
            .iter()
            .map(|spec| {
                let span = spec.span.unwrap_or(1);
                let chart = crate::chart::render(
                    spec,
                    rows,
                    self.theme,
                    chart_width(self.width, span, f64::from(self.theme.space_md)),
                )?;
                Ok(Card {
                    title: spec.title.clone(),
                    span,
                    chart,
                })
            })
            .collect::<Result<Vec<_>, Error>>()?;
        let payload = script_safe(jt::to_string(&DashboardJson(self, rows)));
        Ok(rsx::Template::render_to_string(
            crate::views::dashboard::DashboardView {
                dashboard: self,
                rows,
                cards: &cards,
                payload: &payload,
            },
        )?)
    }
}

/// One chart on its own: a `<figure>` with the chart, its legend, and its payload.
/// `stream` makes it live after hydration; `None` keeps the embedded rows.
pub fn figure(
    spec: &Spec,
    rows: &[Row],
    theme: &Theme,
    width: f64,
    stream: Option<&Stream>,
) -> Result<String, Error> {
    let chart = crate::chart::render(spec, rows, theme, width)?;
    let payload = script_safe(jt::to_string(&ChartJson(spec, rows, theme, stream)));
    Ok(rsx::Template::render_to_string(
        crate::views::dashboard::Figure {
            theme,
            chart: &chart,
            payload: &payload,
        },
    )?)
}

/// Only the markup, no payload: a static chart for pages without JavaScript.
pub fn static_figure(
    spec: &Spec,
    rows: &[Row],
    theme: &Theme,
    width: f64,
) -> Result<String, Error> {
    let chart = crate::chart::render(spec, rows, theme, width)?;
    Ok(rsx::Template::render_to_string(
        crate::views::dashboard::Figure {
            theme,
            chart: &chart,
            payload: "",
        },
    )?)
}
