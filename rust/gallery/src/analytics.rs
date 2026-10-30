//! The Analytics page: billing analytics for a subscription business, as d3set dashboards,
//! drawn from sample billing data.
//!
//! Six tabs, three of them with views of their own. Each view is one d3set dashboard with its
//! filters (date range, currency, and more). Pivot tables are d3set tables with `options.pivot`;
//! a chart that reads only some rows of its view has `options.where`.

use d3set_ssr::spec::{Column, Threshold};
use d3set_ssr::{Agg, Dashboard, Filter, Spec};

/// A top tab. A tab with one view has no second row of tabs.
pub struct Tab {
    pub id: &'static str,
    pub name: &'static str,
    pub views: &'static [View],
}

pub struct View {
    pub id: &'static str,
    pub name: &'static str,
}

pub const TABS: [Tab; 6] = [
    Tab {
        id: "subscriptions",
        name: "Subscriptions",
        views: &[
            View { id: "subscriptions-active", name: "Active subscriptions" },
            View { id: "subscriptions-new", name: "New subscriptions" },
            View { id: "subscriptions-churn", name: "Churn" },
        ],
    },
    Tab {
        id: "revenue",
        name: "Revenue",
        views: &[
            View { id: "revenue-streams", name: "Revenue streams" },
            View { id: "revenue-mrr", name: "MRR" },
        ],
    },
    Tab { id: "credit-ledgers", name: "Credit ledgers", views: &[View { id: "credit-ledgers", name: "Credit ledgers" }] },
    Tab { id: "usage", name: "Usage", views: &[View { id: "usage", name: "Usage" }] },
    Tab {
        id: "cash-collection",
        name: "Cash collection",
        views: &[View { id: "payments", name: "Payments" }, View { id: "dunnings", name: "Dunnings" }],
    },
    Tab { id: "invoices", name: "Invoices", views: &[View { id: "invoices", name: "Invoices" }] },
];

/// The tab of a view, and the view.
pub fn find(view: &str) -> Option<(&'static Tab, &'static View)> {
    TABS.iter().find_map(|t| t.views.iter().find(|v| v.id == view).map(|v| (t, v)))
}

/// Width of the dashboard: the 960px page. Two grid columns: a full row spans both.
pub const WIDTH: f64 = 960.0;
/// A whole row, and half of one.
const FULL: u8 = 2;
const HALF: u8 = 1;
/// Height of the area, line and stacked bar charts.
const CHART: u32 = 232;
const TABLE: u32 = 320;
/// The big number and its change, as the header of a section.
const HEADLINE: u32 = 88;

fn money() -> &'static str {
    "$,.2f"
}

fn columns(fields: &[&str]) -> Vec<Column> {
    fields
        .iter()
        .map(|f| {
            let c = Column::new(f).label(&label(f));
            if ["amount", "balance", "paid"].iter().any(|k| f.contains(k)) {
                c.format(money())
            } else if f.starts_with("days") {
                c.format(",d")
            } else {
                c
            }
        })
        .collect()
}

/// `customer_name` → `Customer name`, as the column headers read.
fn label(field: &str) -> String {
    let s = field.replace('_', " ");
    let mut c = s.chars();
    c.next().map_or_else(String::new, |f| f.to_uppercase().collect::<String>() + c.as_str())
}

/// The analytics chart look: straight lines, the value axis on the right, and only the first and
/// last label on each axis.
fn look(spec: Spec) -> Spec {
    spec.option("ticks", "edges").option("valueAxis", "right").option("curve", "linear").height(CHART).span(FULL)
}

/// Months in the period a big number covers; its change compares it with the months before.
const PERIOD: u32 = 12;

/// A section header: the big number of the last 12 months and its change against the 12 before,
/// as `(T2 − T1) / T1`.
fn headline(title: &str, x: &str, y: &str) -> Spec {
    Spec::new("kpi").title(title).x(x).y(y).aggregate(Agg::Sum).option("period", PERIOD).height(HEADLINE).span(HALF)
}

/// An area: one series, a 2px line over a gradient.
fn area(x: &str, y: &str) -> Spec {
    look(Spec::new("area").x(x).y(y).aggregate(Agg::Sum).stacked(false)).option("gradient", true)
}

/// Lines: one 2px line per series.
fn lines(x: &str, y: &str, series: &str) -> Spec {
    look(Spec::new("line").x(x).y(y).series(series).aggregate(Agg::Sum))
}

/// Stacked bars: bars by month, stacked by sign (outflows below zero), square corners.
fn stacked(x: &str, y: &str, series: &str) -> Spec {
    look(Spec::new("bar").x(x).y(y).series(series).stacked(true))
}

/// Inline bars: the split of one total as a single thin bar.
fn inline(x: &str, y: &str, series: &str) -> Spec {
    Spec::new("bar").x(x).y(y).series(series).stacked(true).horizontal(true).option("axes", "none").height(24).span(FULL)
}

/// The breakout under a chart: one line per `x` with its color dot, one column per month.
fn breakout(title: &str, x: &str, y: &str) -> Spec {
    Spec::new("table").title(title).x(x).y(y).aggregate(Agg::Sum).option("pivot", "period").option("swatch", true).height(TABLE).span(FULL)
}

/// A pivot by currency first, so currencies never mix, then `series`.
fn pivot(title: &str, series: &str, y: &str) -> Spec {
    Spec::new("table").title(title).x("Currency").series(series).y(y).aggregate(Agg::Sum).option("pivot", "period").height(TABLE).span(FULL)
}

fn table(title: &str, fields: &[&str]) -> Spec {
    Spec::new("table").title(title).columns(columns(fields)).limit(100).height(TABLE).span(FULL)
}

/// Breakout cell colors: green above zero, red below, grey at zero.
fn signs() -> Vec<Threshold> {
    let color = |op, value, c: &str| Threshold { op, value, level: None, color: Some(c.into()), label: None };
    vec![color(">", 0.0, "#008559"), color("<", 0.0, "#DC3309"), color("=", 0.0, "#8C95A6")]
}

/// Filters of every view: date range and currency first, then the others.
fn filters(currency: &str, plan: bool) -> Vec<Filter> {
    let mut f = vec![Filter::date_range("month").labeled("Date range"), Filter::select(currency).labeled("Currency")];
    f.push(Filter::select("customer_country").labeled("Country"));
    f.push(Filter::select("customer_type").labeled("Customer type"));
    if plan {
        f.push(Filter::select("plan_name").labeled("Plan"));
    }
    f
}

/// The sections of a view: the big numbers, the chart,
/// its breakout, then the breakdowns and lists.
fn view(id: &str) -> Option<(Vec<Spec>, Vec<Filter>)> {
    let charts = match id {
        "subscriptions-active" => vec![
            headline("Active subscriptions", "month", "active_subscriptions").format(",d").option("value", "last").option("where", "set=snapshot"),
            headline("Subscriptions, last 12 months", "month", "active_subscriptions").format(",d").option("where", "set=snapshot"),
            area("month", "active_subscriptions").format(",d").option("where", "set=snapshot"),
            breakout("Active subscriptions by plan", "Plan", "active_subscriptions").format(",d").option("where", "set=snapshot"),
            table("Active subscriptions", &["activated_on", "subscription_external_id", "plan_name", "plan_code", "is_override", "currency", "billing_interval", "customer_name", "customer_external_id", "days_active", "is_plan_change"]).option("where", "set=current"),
        ],
        "subscriptions-new" => vec![
            headline("New subscriptions", "month", "new_subscriptions").format(",d"),
            headline("Plan changes", "month", "new_subscriptions").format(",d").option("where", "subscription_type=Plan change"),
            stacked("period", "new_subscriptions", "subscription_type").format(",d"),
            Spec::new("bar").title("Day of new subscriptions").x("weekday").option("categories", crate::billing::WEEK).y("new_subscriptions").format(",d").option("valueAxis", "right").height(CHART).span(HALF),
            breakout("New subscriptions by plan", "Plan", "new_subscriptions").format(",d").span(HALF).height(CHART),
            table("New subscriptions", &["activated_on", "subscription_external_id", "customer_name", "customer_external_id", "plan_name", "plan_code", "is_override", "currency", "billing_interval", "current_status", "subscription_type", "previous_plan_name"]),
        ],
        "subscriptions-churn" => vec![
            headline("Terminations", "month", "terminations").format(",d").option("where", "termination=Terminations"),
            headline("Plan changes", "month", "terminations").format(",d").option("where", "termination=Plan changes"),
            stacked("period", "terminations", "termination").format(",d"),
            Spec::new("bar").title("Day of terminations").x("weekday").option("categories", crate::billing::WEEK).y("terminations").format(",d").option("valueAxis", "right").height(CHART).span(HALF),
            breakout("Churned subscriptions by plan", "Plan", "terminations").format(",d").span(HALF).height(CHART),
            table("Churned subscriptions", &["terminated_on", "customer_name", "customer_external_id", "plan_name", "plan_code", "is_override", "plan_amount", "currency", "billing_interval", "days_alive", "termination_category", "next_plan_name", "subscription_external_id"]),
        ],
        "revenue-streams" => vec![
            headline("Gross revenue", "month", "revenue_amount").format(money()).option("where", "set=gross"),
            headline("Net revenue", "month", "revenue_amount").format(money()),
            lines("month", "revenue_amount", "Stream").format("$~s").option("where", "set=gross"),
            breakout("Revenue streams", "Stream", "revenue_amount").format(money()).thresholds(signs()).height(440),
            pivot("Revenue by plan", "Plan", "revenue_amount").format(money()),
        ],
        "revenue-mrr" => vec![
            headline("MRR", "month", "mrr_amount").format(money()).option("value", "last").option("where", "Movement=Ending MRR"),
            headline("New MRR, last 12 months", "month", "mrr_amount").format(money()).option("where", "Movement=New"),
            area("month", "mrr_amount").format("$~s").option("where", "Movement=Ending MRR"),
            breakout("MRR breakout", "Movement", "mrr_amount").format(money()).thresholds(signs()).height(290),
            pivot("MRR by plan", "Plan", "mrr_amount").format(money()).option("where", "Movement=Ending MRR"),
        ],
        "credit-ledgers" => vec![
            headline("Purchased credits", "month", "metric_value").format(money()).option("where", "Credit type=Purchased credits"),
            headline("Consumed credits", "month", "metric_value").format(money()).option("where", "Credit type=Consumed credits"),
            stacked("period", "metric_value", "Credit type").format("$~s").option("where", "set=movement"),
            breakout("Credit ledger", "Credit type", "metric_value").format(money()).thresholds(signs()).height(240).option("where", "set=movement"),
            table("Credit balances", &["month", "customer_name", "customer_external_id", "customer_country", "amount_currency", "start_of_month_balance", "monthly_balance_change", "end_of_month_balance"]).option("where", "set=balance"),
        ],
        "usage" => {
            let mut v = vec![
                headline("Total usage spend", "month", "usage_amount").format(money()),
                // Amounts only: units of different metrics do not add up.
                headline("Usage spend, last month", "month", "usage_amount").format(money()).option("value", "last"),
                area("month", "usage_amount").format("$~s"),
            ];
            // One chart per billable metric, two by row, in metric name order.
            for (code, name) in crate::billing::metrics() {
                v.push(
                    Spec::new("bar").title(name).x("period").y("usage_amount").format("$~s").option("ticks", "edges").option("valueAxis", "right").option("where", format!("billable_metric_code={code}")).height(CHART).span(HALF),
                );
            }
            v.push(pivot("Usage by billable metric", "Billable metric", "usage_amount").format(money()));
            v
        }
        "payments" => vec![
            headline("Successful payments", "month", "payment_amount").format(money()).option("where", "payment_status=Succeeded"),
            headline("Failed attempts", "month", "payment_count").format(",d").option("where", "payment_status=Failed"),
            inline("all", "payment_count", "payment_status").title("Payment attempts by status").format(",d"),
            stacked("period", "payment_count", "error_code").title("Failed payment reasons").format(",d").option("where", "payment_status=Failed").span(HALF),
            stacked("period", "payment_count", "payment_method_type").title("Successful payments by method").format(",d").option("where", "payment_status=Succeeded").span(HALF),
            table("Payments", &["payment_date", "payment_id", "customer_external_id", "email", "invoice_number", "payment_amount", "currency", "payment_status", "payment_method_type", "card_brand", "error_code"]),
        ],
        "dunnings" => vec![
            headline("Revenue recovered", "month", "revenue_recovered").format(money()),
            headline("Invoices in dunning", "month", "invoice_count").format(",d"),
            stacked("period", "invoice_count", "status").title("Dunning outcome").format(",d"),
            Spec::new("table").title("Revenue recovered by currency").x("currency").y("revenue_recovered").aggregate(Agg::Sum).format(money()).height(CHART).span(HALF),
            Spec::new("bar").title("Recovery time").x("payment_timeframe").y("invoice_count").horizontal(true).format(",d").height(CHART).span(HALF),
            table("Dunning attempts per invoice", &["invoice_number", "customer_name", "currency", "invoice_amount", "total_dunning_attempts", "invoice_is_paid", "first_attempt_date", "days_to_payment"]),
        ],
        "invoices" => vec![
            headline("Invoiced", "month", "total_amount").format(money()).option("where", "invoice_status=Finalized"),
            // A stock as of today: no month to compare with.
            Spec::new("kpi").title("Outstanding").y("outstanding_amount").aggregate(Agg::Sum).format(money()).option("where", "is_outstanding=true").height(HEADLINE).span(HALF),
            inline("all", "invoice_count", "payment_status").title("Invoices by payment status").format(",d").option("where", "invoice_status=Finalized"),
            Spec::new("table").title("Payment status").x("payment_status").y("total_amount").aggregate(Agg::Sum).columns(vec![Column::new("payment_status").label("Payment status"), Column::new("sum(total_amount)").label("Amount").format(money())]).option("swatch", true).option("where", "invoice_status=Finalized").height(200).span(FULL),
            stacked("period", "total_amount", "invoice_type").title("Invoiced amount by type").format("$~s"),
            Spec::new("bar").title("AR aging").x("invoice_age").y("outstanding_amount").series("currency").stacked(true).horizontal(true).format("$~s").option("where", "is_outstanding=true").height(CHART).span(HALF),
            Spec::new("bar").title("Invoice status").x("period").y("invoice_count").series("invoice_status").stacked(true).format(",d").option("ticks", "edges").option("valueAxis", "right").height(CHART).span(HALF),
            table("Invoices", &["issuing_date", "invoice_number", "customer_name", "customer_external_id", "customer_country", "invoice_type", "invoice_status", "payment_status", "currency", "total_amount", "total_paid", "outstanding_amount", "is_overdue"]),
        ],
        _ => return None,
    };
    let plan = !matches!(id, "credit-ledgers" | "dunnings" | "payments");
    Some((charts, filters("currency", plan)))
}

/// The dashboard of a view, in `theme`.
pub fn dashboard(id: &str, theme: &'static d3set_ssr::Theme) -> Option<Dashboard> {
    let (charts, filters) = view(id)?;
    Some(Dashboard {
        charts,
        filters,
        // No time window: the data is monthly, and the date range filter covers it.
        time_field: None,
        theme,
        width: WIDTH,
        ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_view_renders() {
        let mut charts = 0;
        for tab in &TABS {
            for v in tab.views {
                let d = dashboard(v.id, &crate::theme::GALLERY).expect(v.id);
                charts += d.charts.len();
                let html = d.render(&crate::billing::rows(v.id)).unwrap_or_else(|e| panic!("{}: {e}", v.id));
                assert!(html.contains("d3s-card"), "{}", v.id);
            }
        }
        // Every view has its sections: 38 charts in 10 views.
        assert!(charts >= 38, "{charts} charts");
    }
}
