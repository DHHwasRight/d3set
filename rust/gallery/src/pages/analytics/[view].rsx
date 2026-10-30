// A view of the Analytics page: the tab widget (tabs, then the views of the current tab), and the
// view's dashboard. Each tab is a link, so a tab change is a partial navigation.

use crate::analytics::{Tab, View, TABS};

pub fn AnalyticsPage(tab: &Tab, view: &View, markup: &str, rows: usize) -> Element {
    <article class="page analytics">
        <div class="eyebrow">Analytics</div>
        <h1>Analytics</h1>
        <p class="lead">Billing analytics for a subscription business, drawn by d3set from sample billing data: {rows} rows in this view<span data-snippet="rendered">, rendered on the server and hydrated</span>.</p>
        <Tabs tab={tab} view={view} />
        <section class="tab-panel" role="tabpanel" aria-label={view.name}>
            <div class="dashboard">{!markup}</div>
        </section>
    </article>
}

pub fn Tabs(tab: &Tab, view: &View) -> Element {
    <nav class="tabs" aria-label="Analytics">
        <div class="tabs-row" role="tablist">
            for t in TABS.iter() {
                <a role="tab" class="tab" href={href(t.views[0].id)} aria-selected={selected(t.id == tab.id)}>{t.name}</a>
            }
        </div>
        if tab.views.len() > 1 {
            <div class="tabs-row tabs-pills" role="tablist">
                for v in tab.views.iter() {
                    <a role="tab" class="tab-pill" href={href(v.id)} aria-selected={selected(v.id == view.id)}>{v.name}</a>
                }
            </div>
        }
    </nav>
}

fn href(id: &str) -> String {
    format!("/analytics/{id}")
}

fn selected(on: bool) -> &'static str {
    if on { "true" } else { "false" }
}
