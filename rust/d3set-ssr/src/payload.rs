//! The JSON a page embeds for hydration, written with jt.
//!
//! Field names are the TypeScript ones (`innerRadius`, `decreaseIsGood`), so the browser
//! reads the payload with no mapping.

use crate::dashboard::{Dashboard, Filter, Stream};
use crate::spec::{Column, Spec, Threshold};
use crate::theme::Theme;
use crate::value::{Row, Value};

jt::template! {
    pub fn RowJson(r: &Row) -> Json {
        ...&r.0
    }
}

jt::template! {
    pub fn RowsJson(rows: &[Row]) -> Json = [ for r in rows { RowJson(r) } ];
}

jt::template! {
    pub fn ThresholdJson(t: &Threshold) -> Json {
        "op": t.op,
        "value": t.value,
        "level"?: t.level.map(|l| l.name()),
        "color"?: t.color.as_deref(),
        "label"?: t.label.as_deref(),
    }
}

jt::template! {
    pub fn ColumnJson(c: &Column) -> Json {
        "field": c.field.as_str(),
        "label"?: c.label.as_deref(),
        "format"?: c.format.as_deref(),
        "align"?: c.align,
        if !c.thresholds.is_empty() { "thresholds": [ for t in &c.thresholds { ThresholdJson(t) } ] }
    }
}

jt::template! {
    pub fn OptionsJson(o: &[(String, Value)]) -> Json {
        ...o
    }
}

jt::template! {
    pub fn SpecJson(s: &Spec) -> Json {
        "type": s.kind.as_str(),
        "title"?: s.title.as_deref(),
        "x"?: s.x.as_deref(),
        "y"?: s.y.as_deref(),
        "series"?: s.series.as_deref(),
        "aggregate"?: s.aggregate.map(|a| a.name()),
        "format"?: s.format.as_deref(),
        "height"?: s.height,
        "span"?: s.span,
        "interval"?: s.interval.as_deref(),
        "display"?: s.display,
        "size"?: s.size.as_deref(),
        "stacked"?: s.stacked,
        "horizontal"?: s.horizontal,
        "limit"?: s.limit,
        "bins"?: s.bins,
        "min"?: s.min,
        "max"?: s.max,
        "innerRadius"?: s.inner_radius,
        "window"?: s.window.as_deref(),
        "decreaseIsGood"?: s.decrease_is_good,
        "text"?: s.text.as_deref(),
        if !s.thresholds.is_empty() { "thresholds": [ for t in &s.thresholds { ThresholdJson(t) } ] }
        if !s.columns.is_empty() { "columns": [ for c in &s.columns { ColumnJson(c) } ] }
        if let Some(o) = &s.objective {
            "objective": { "good": { "op": o.good_op, "value": o.good_value }, "target": o.target },
        }
        if !s.options.is_empty() { "options": OptionsJson(&s.options) }
    }
}

jt::template! {
    pub fn FilterJson(f: &Filter) -> Json {
        "id": f.id(),
        "field": f.field(),
        "label": f.label(),
        "param": f.id(),
        match f {
            Filter::Select { multiple, options, .. } => {
                "type": "select",
                "multiple": *multiple,
                "options"?: options.as_deref(),
            }
            Filter::Range { min, max, .. } => {
                "type": "range",
                "min"?: *min,
                "max"?: *max,
            }
            Filter::Search { .. } => { "type": "search" }
            Filter::DateRange { .. } => { "type": "dateRange" }
        }
    }
}

jt::template! {
    pub fn NamedJson(n: &[(&'static str, &'static str)]) -> Json {
        ...n
    }
}

jt::template! {
    /// The TypeScript `Theme`, so the browser draws with the server's tokens.
    pub fn ThemeJson(t: &Theme) -> Json {
        "name": t.name,
        "font": { "family": t.font_family, "sizeAxis": t.font_axis, "sizeLabel": t.font_label, "sizeTitle": t.font_title },
        "color": {
            "background": t.background,
            "surface": t.surface,
            "text": t.text,
            "textMuted": t.text_muted,
            "grid": t.grid,
            "axis": t.axis,
            "accent": t.accent,
            "positive": t.positive,
            "warning": t.warning,
            "negative": t.negative,
            "series": t.series,
            "sequential": t.sequential,
            if !t.named.is_empty() { "named": NamedJson(t.named) }
        },
        "space": { "xs": 4, "sm": t.space_sm, "md": t.space_md, "lg": 24 },
        "radius": t.radius,
        "motion": t.motion,
    }
}

jt::template! {
    pub fn StreamJson(s: &Stream) -> Json {
        "url": s.url.as_str(),
        "maxRows"?: s.max_rows,
        if let Some(key) = &s.key { "mode": "upsert", "key": key.as_str() }
    }
}

jt::template! {
    pub fn DashboardJson(d: &Dashboard, rows: &[Row]) -> Json {
        "theme": ThemeJson(d.theme),
        "charts": [ for s in &d.charts { SpecJson(s) } ],
        "filters": [ for f in &d.filters { FilterJson(f) } ],
        "filterMode"?: d.filter_mode,
        "timeField"?: d.time_field.as_deref(),
        "timeWindow"?: d.time_window.as_deref(),
        if let Some(s) = &d.stream { "stream": StreamJson(s) }
        "rows": RowsJson(rows),
    }
}

jt::template! {
    pub fn ChartJson(s: &Spec, rows: &[Row], theme: &Theme, stream: Option<&Stream>) -> Json {
        "theme": ThemeJson(theme),
        "spec": SpecJson(s),
        if let Some(st) = stream { "stream": StreamJson(st) }
        "rows": RowsJson(rows),
    }
}

/// JSON for a `<script type="application/json">`: `</` cannot close the script element.
pub fn script_safe(json: String) -> String {
    json.replace("</", "<\\/")
}
