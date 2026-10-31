//! `/dashboards/{name}`: a full dashboard rendered on the server, hydrated, and live.

use d3set_ssr::spec::{Column, Level, Threshold};
use d3set_ssr::{Agg, Dashboard, Filter, Spec};

use crate::catalog::Feed;
use crate::pages::{html, views, Ctx, Error, IntoResponse};
use crate::site::{js, rows, stream, DASHBOARD};

fn latency() -> Vec<Threshold> {
    vec![Threshold::new(">", 500.0, Level::Critical), Threshold::new(">", 250.0, Level::Warning)]
}

/// The dashboard, its title, and its feed.
fn dashboard(name: &str) -> Option<(&'static str, &'static str, Feed, Dashboard)> {
    let ops = || Dashboard {
        charts: vec![
            Spec::new("kpi").title("Requests").x("at").y("id").aggregate(Agg::Count).interval("1m"),
            Spec::new("kpi").title("Average latency (ms)").y("latency").aggregate(Agg::Avg).thresholds(latency()).format(",.0f"),
            Spec::new("slo").title("Latency SLO (≤ 500 ms)").y("latency").objective("<=", 500.0, 95.0),
            Spec::new("timeseries").title("Requests by service").x("at").y("id").series("service").aggregate(Agg::Count).display("bars").span(2),
            Spec::new("toplist").title("Slowest hosts").x("host").y("latency").aggregate(Agg::Avg).thresholds(latency()).format(",.0f"),
            Spec::new("timeseries").title("Average latency by service").x("at").y("latency").series("service").aggregate(Agg::Avg).thresholds(latency()).span(2),
            Spec::new("change").title("Errors, last 5 min").x("at").y("errors").series("service").window("5m").decrease_is_good(true),
            Spec::new("timeheatmap").title("Latency distribution").x("at").y("latency").bins(12).span(2),
            Spec::new("hostmap").title("Host map").x("host").y("latency").aggregate(Agg::Avg).series("service").thresholds({
                let mut t = latency();
                t.push(Threshold::new(">=", 0.0, Level::Ok));
                t
            }),
            Spec::new("status").title("Host checks").x("host").y("check").series("at").span(2),
            Spec::new("sunburst").title("Requests, region › service").x("service").series("region").y("id").aggregate(Agg::Count),
            Spec::new("stream").title("Log stream").x("at").y("message").series("level").columns(vec![Column::new("host")]).limit(80).span(2),
            Spec::new("note").title("About").text("Request logs from 24 hosts.\n\nWarning above 250 ms, critical above 500 ms."),
        ],
        filters: vec![Filter::multi_select("service"), Filter::select("region"), Filter::select("host"), Filter::search("message")],
        time_field: Some("at".into()),
        time_window: Some("15m".into()),
        // Recorded rows (a fixed clock): the window counts from their time, not the browser's.
        now: *crate::data::FROZEN,
        theme: &crate::theme::GALLERY,
        width: DASHBOARD,
        ..Default::default()
    };
    let sales = || Dashboard {
        charts: vec![
            Spec::new("kpi").title("Revenue").x("at").y("amount").interval("1m").format("$,.0f"),
            Spec::new("kpi").title("Orders").x("at").y("id").aggregate(Agg::Count).interval("1m"),
            Spec::new("gauge").title("Average order").y("amount").aggregate(Agg::Avg).min(0.0).max(500.0).format("$,.0f"),
            Spec::new("line").title("Revenue per minute").x("at").y("amount").series("region").aggregate(Agg::Sum).interval("1m").format("$~s").span(2),
            Spec::new("donut").title("Revenue by region").x("region").y("amount").format("$~s"),
            Spec::new("bar").title("Revenue by customer").x("customer").y("amount").series("product").stacked(true).horizontal(true).format("$~s").span(2),
            Spec::new("funnel").title("Conversion").x("stage").y("id").aggregate(Agg::Count).option("sort", true),
            Spec::new("histogram").title("Order size").y("amount").bins(15).format("$~s"),
            Spec::new("boxplot").title("Order size by region").x("region").y("amount").format("$~s"),
            Spec::new("treemap").title("Revenue, region › product").x("product").series("region").y("amount").format("$~s"),
            Spec::new("table").title("Top customers").x("customer").y("amount").aggregate(Agg::Sum).format("$,.0f"),
            Spec::new("scatter").title("Seats against amount").x("seats").y("amount").size("seats").series("product").limit(400).span(2),
        ],
        filters: vec![Filter::multi_select("region"), Filter::select("product"), Filter::range("amount"), Filter::search("customer")],
        time_field: Some("at".into()),
        // Recorded rows (a fixed clock): the window counts from their time, not the browser's.
        now: *crate::data::FROZEN,
        theme: &crate::theme::GALLERY,
        width: DASHBOARD,
        ..Default::default()
    };
    match name {
        "ops" => Some(("Observability", "Request logs from 24 hosts: volume, latency, errors, and checks.", Feed::Ops, ops())),
        "sales" => Some(("Business", "Orders by region, product, and customer, with the conversion funnel.", Feed::Sales, sales())),
        _ => None,
    }
}

pub fn handle(ctx: &mut Ctx) -> Result<impl IntoResponse, Error> {
    let name = ctx.require("name")?.to_string();
    let (title, lead, feed, _) = dashboard(&name).ok_or_else(|| Error::new(404, "No such dashboard"))?;
    let js = js();
    let mut data = rows(feed, if feed == Feed::Ops { 4000 } else { 2000 });
    if feed == Feed::Ops {
        // The dashboard opens on a 15-minute window: embed only what it shows.
        let since = crate::data::now() - 15.0 * 60_000.0;
        data.retain(|r| r.get("at").as_str().and_then(d3set_ssr::time::parse_iso).is_some_and(|t| t >= since));
    }
    let (_, _, _, mut d) = dashboard(&name).ok_or_else(|| Error::new(404, "No such dashboard"))?;
    d.width = DASHBOARD;
    if js {
        d.stream = Some(stream(feed, &data, data.len()));
    }
    let markup = d.render(&data).map_err(|e| Error::internal(e.to_string()))?;
    html!(ctx, views::dashboards::_name_::DashboardPage { title, lead, markup: &markup, js, path: &ctx.path, rows: data.len() })
}
