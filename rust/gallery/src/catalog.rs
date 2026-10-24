//! Every chart type the gallery shows: where it sits in the navigation, what it is for, and examples.

use d3set_ssr::spec::{Column, Level, Threshold};
use d3set_ssr::{Agg, Spec};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Feed {
    Ops,
    Sales,
}

impl Feed {
    pub fn name(self) -> &'static str {
        match self {
            Feed::Ops => "ops",
            Feed::Sales => "sales",
        }
    }
}

pub struct Example {
    pub title: &'static str,
    pub note: &'static str,
    pub feed: Feed,
    pub spec: Spec,
}

pub struct Entry {
    pub kind: &'static str,
    pub name: &'static str,
    pub summary: &'static str,
    pub examples: Vec<Example>,
}

pub struct Group {
    pub name: &'static str,
    pub kinds: &'static [&'static str],
}

pub const GROUPS: &[Group] = &[
    Group {
        name: "Time series",
        kinds: &["timeseries", "line", "area"],
    },
    Group {
        name: "Comparison",
        kinds: &["bar", "toplist", "change", "table"],
    },
    Group {
        name: "Composition",
        kinds: &["pie", "donut", "treemap", "sunburst", "funnel"],
    },
    Group {
        name: "Distribution",
        kinds: &["histogram", "boxplot", "heatmap", "timeheatmap", "scatter"],
    },
    Group {
        name: "Single value",
        kinds: &["kpi", "gauge", "slo"],
    },
    Group {
        name: "Monitoring",
        kinds: &["hostmap", "status", "stream", "note"],
    },
];

fn latency() -> Vec<Threshold> {
    vec![
        Threshold::new(">", 500.0, Level::Critical),
        Threshold::new(">", 250.0, Level::Warning),
    ]
}

fn ex(title: &'static str, note: &'static str, feed: Feed, spec: Spec) -> Example {
    Example {
        title,
        note,
        feed,
        spec,
    }
}

pub fn entry(kind: &str) -> Option<Entry> {
    use Feed::{Ops, Sales};
    let e = |kind, name, summary, examples| Entry {
        kind,
        name,
        summary,
        examples,
    };
    Some(match kind {
        "timeseries" => e(
            "timeseries",
            "Time series",
            "Values over time, bucketed automatically, as lines, areas, or stacked bars. Threshold rules draw marker lines.",
            vec![
                ex("Requests by service", "`display: bars`, count per auto bucket.", Ops, Spec::new("timeseries").x("at").y("id").series("service").aggregate(Agg::Count).display("bars")),
                ex("Average latency", "Line per service with warning and critical markers.", Ops, Spec::new("timeseries").x("at").y("latency").series("service").aggregate(Agg::Avg).thresholds(latency())),
                ex("Requests by region", "`display: area`, stacked.", Ops, Spec::new("timeseries").x("at").y("id").series("region").aggregate(Agg::Count).display("area")),
            ],
        ),
        "line" => e("line", "Line", "One line per series over a time or number axis, with monotone curves.", vec![
            ex("Revenue per minute", "Sum per 1-minute bucket, one line per region.", Sales, Spec::new("line").x("at").y("amount").series("region").aggregate(Agg::Sum).interval("1m").format("$~s")),
        ]),
        "area" => e("area", "Area", "Filled areas, stacked by default; `stacked: false` overlaps them.", vec![
            ex("Revenue by product", "Stacked per 1-minute bucket.", Sales, Spec::new("area").x("at").y("amount").series("product").aggregate(Agg::Sum).interval("1m").format("$~s")),
            ex("Latency by region", "Overlapping (`stacked: false`), average per 30 s.", Ops, Spec::new("area").x("at").y("latency").series("region").aggregate(Agg::Avg).interval("30s").stacked(false)),
        ]),
        "bar" => e("bar", "Bar", "Values per category: grouped or stacked, vertical or horizontal, with `limit` for the largest.", vec![
            ex("Revenue by product", "Grouped by region.", Sales, Spec::new("bar").x("product").y("amount").series("region").format("$~s")),
            ex("Revenue by customer", "Stacked and horizontal.", Sales, Spec::new("bar").x("customer").y("amount").series("product").stacked(true).horizontal(true).format("$~s")),
            ex("Slowest hosts", "Average latency, top 6 and \"Other\".", Ops, Spec::new("bar").x("host").y("latency").aggregate(Agg::Avg).limit(6).format(",.0f")),
        ]),
        "toplist" => e("toplist", "Top list", "A ranked list with bars, colored by threshold rules.", vec![
            ex("Slowest hosts", "Average latency, warning above 250 ms.", Ops, Spec::new("toplist").x("host").y("latency").aggregate(Agg::Avg).thresholds(latency()).format(",.0f")),
        ]),
        "change" => e("change", "Change", "The last window against the window before it, per series.", vec![
            ex("Errors per service", "Last 5 minutes; a decrease is good.", Ops, Spec::new("change").x("at").y("errors").series("service").window("5m").decrease_is_good(true)),
        ]),
        "table" => e("table", "Table", "Sortable rows, raw or grouped, with formats and conditional colors.", vec![
            ex("Top customers", "Group mode: one line per customer.", Sales, Spec::new("table").x("customer").y("amount").aggregate(Agg::Sum).format("$,.0f")),
            ex("Latest requests", "Raw mode with chosen columns.", Ops, Spec::new("table").limit(50).columns(vec![
                Column::new("at").label("Time"),
                Column::new("host"),
                Column::new("service"),
                Column::new("status"),
                Column { thresholds: latency(), ..Column::new("latency").label("Latency (ms)") },
            ])),
        ]),
        "pie" => e("pie", "Pie", "Share of a total by category.", vec![
            ex("Orders by product", "Count of orders.", Sales, Spec::new("pie").x("product").y("amount").aggregate(Agg::Count)),
        ]),
        "donut" => e("donut", "Donut", "A pie with a hole: the same data, easier to read with many slices.", vec![
            ex("Revenue by region", "Sum of order amounts.", Sales, Spec::new("donut").x("region").y("amount").format("$~s")),
        ]),
        "treemap" => e("treemap", "Treemap", "Nested rectangles sized by value, grouped by series.", vec![
            ex("Revenue by region and product", "Grouped by region.", Sales, Spec::new("treemap").x("product").series("region").y("amount").format("$~s")),
        ]),
        "sunburst" => e("sunburst", "Sunburst", "Two-level share of a total: inner ring per series, outer ring per category.", vec![
            ex("Requests by region and service", "Count of requests.", Ops, Spec::new("sunburst").x("service").series("region").y("id").aggregate(Agg::Count)),
        ]),
        "funnel" => e("funnel", "Funnel", "Conversion between the stages of a process.", vec![
            ex("Conversion", "Count per stage, sorted by size.", Sales, Spec::new("funnel").x("stage").y("id").aggregate(Agg::Count).option("sort", true)),
        ]),
        "histogram" => e("histogram", "Histogram", "The distribution of one number in bins.", vec![
            ex("Order size", "15 bins.", Sales, Spec::new("histogram").y("amount").bins(15).format("$~s")),
            ex("Latency", "30 bins: the slow tail shows on the right.", Ops, Spec::new("histogram").y("latency").bins(30)),
        ]),
        "boxplot" => e("boxplot", "Box plot", "Quartiles, whiskers at 1.5 × IQR, and outliers per category.", vec![
            ex("Latency by service", "Outliers are the slow tail.", Ops, Spec::new("boxplot").x("service").y("latency")),
        ]),
        "heatmap" => e("heatmap", "Heatmap", "Two categories crossed, colored by value.", vec![
            ex("Revenue, customer × region", "Sum of amounts.", Sales, Spec::new("heatmap").x("customer").series("region").y("amount").format("$~s")),
        ]),
        "timeheatmap" => e("timeheatmap", "Time heatmap", "How values spread over time: time buckets × value bins, colored by count.", vec![
            ex("Latency distribution", "12 bins per time bucket.", Ops, Spec::new("timeheatmap").x("at").y("latency").bins(12)),
        ]),
        "scatter" => e("scatter", "Scatter", "One dot per row; a size field makes a bubble chart.", vec![
            ex("Seats against amount", "Bubble size is seats, color is product.", Sales, Spec::new("scatter").x("seats").y("amount").size("seats").series("product").limit(400)),
        ]),
        "kpi" => e("kpi", "KPI", "A big number, with a trend line and the change against the previous bucket.", vec![
            ex("Revenue", "Sum, trend per minute.", Sales, Spec::new("kpi").x("at").y("amount").interval("1m").format("$,.0f")),
            ex("Average latency", "Colored by threshold rules.", Ops, Spec::new("kpi").y("latency").aggregate(Agg::Avg).thresholds(latency()).format(",.0f")),
        ]),
        "gauge" => e("gauge", "Gauge", "One value on an arc between a minimum and a maximum.", vec![
            ex("Average latency", "0 to 800 ms, threshold ticks.", Ops, Spec::new("gauge").y("latency").aggregate(Agg::Avg).min(0.0).max(800.0).thresholds(latency()).format(",.0f")),
        ]),
        "slo" => e("slo", "Service level objective", "The share of good events against a target, and the error budget left.", vec![
            ex("Latency under 500 ms", "Target 95%.", Ops, Spec::new("slo").y("latency").objective("<=", 500.0, 95.0)),
        ]),
        "hostmap" => e("hostmap", "Host map", "One hexagon per entity, grouped, colored by value or status.", vec![
            ex("Average latency per host", "Grouped by service.", Ops, Spec::new("hostmap").x("host").y("latency").aggregate(Agg::Avg).series("service").thresholds({
                let mut t = latency();
                t.push(Threshold::new(">=", 0.0, Level::Ok));
                t
            })),
        ]),
        "status" => e("status", "Check status", "The latest state per entity, worst first.", vec![
            ex("Host checks", "From the `check` field of each request.", Ops, Spec::new("status").x("host").y("check").series("at")),
        ]),
        "stream" => e("stream", "Event stream", "Log lines, newest first, colored by level.", vec![
            ex("Request log", "Host as a tag.", Ops, Spec::new("stream").x("at").y("message").series("level").columns(vec![Column::new("host")]).limit(60)),
        ]),
        "note" => e("note", "Note", "Static text that explains a dashboard. It reads no data.", vec![
            ex("About this dashboard", "Blank lines split paragraphs.", Ops, Spec::new("note").text("Request logs from 24 hosts, pushed with server-sent events.\n\nWarning above 250 ms, critical above 500 ms.")),
        ]),
        _ => return None,
    })
}

/// Every kind, in navigation order.
pub fn kinds() -> impl Iterator<Item = &'static str> {
    GROUPS.iter().flat_map(|g| g.kinds.iter().copied())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn every_chart_in_the_navigation_renders_its_examples_on_the_sample_feeds() {
        crate::data::start();
        for kind in kinds() {
            let e = entry(kind).unwrap_or_else(|| panic!("no catalog entry for {kind}"));
            assert!(!e.examples.is_empty(), "{kind} has no example");
            for ex in &e.examples {
                let view =
                    crate::site::example(ex, true).unwrap_or_else(|err| panic!("{kind}: {err}"));
                assert!(
                    view.html.contains("d3s-payload"),
                    "{kind}: the live example carries no payload"
                );
                assert!(
                    view.html.contains(&format!("\"type\":\"{kind}\"")),
                    "{kind}: the payload names another type"
                );
            }
        }
    }

    #[test]
    fn an_unknown_kind_has_no_entry() {
        assert!(entry("sparkle").is_none());
    }
}
