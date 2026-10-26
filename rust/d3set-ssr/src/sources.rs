//! The rsx source of each chart's server template, for documentation pages.

/// The template that draws `kind` (`views/<file>.rsx`), or `None` for an unknown kind.
pub fn view(kind: &str) -> Option<&'static str> {
    Some(match kind {
        "bar" => include_str!("views/bar.rsx"),
        "line" | "area" | "timeseries" => include_str!("views/xy.rsx"),
        "pie" | "donut" => include_str!("views/pie.rsx"),
        "sunburst" => include_str!("views/sunburst.rsx"),
        "gauge" => include_str!("views/gauge.rsx"),
        "heatmap" => include_str!("views/heatmap.rsx"),
        "timeheatmap" => include_str!("views/timeheatmap.rsx"),
        "histogram" => include_str!("views/histogram.rsx"),
        "scatter" => include_str!("views/scatter.rsx"),
        "boxplot" => include_str!("views/boxplot.rsx"),
        "treemap" => include_str!("views/treemap.rsx"),
        "funnel" => include_str!("views/funnel.rsx"),
        "kpi" => include_str!("views/kpi.rsx"),
        "slo" => include_str!("views/slo.rsx"),
        "note" => include_str!("views/note.rsx"),
        "table" => include_str!("views/table.rsx"),
        "toplist" => include_str!("views/toplist.rsx"),
        "change" => include_str!("views/change.rsx"),
        "hostmap" => include_str!("views/hostmap.rsx"),
        "status" => include_str!("views/status.rsx"),
        "stream" => include_str!("views/stream.rsx"),
        _ => return None,
    })
}

/// The shared frame every chart is wrapped in.
pub const FRAME: &str = include_str!("views/frame.rsx");
