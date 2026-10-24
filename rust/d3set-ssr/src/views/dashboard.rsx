// Dashboard and figure markup. The structure matches `createDashboard` in the TypeScript library,
// so the page looks the same before and after hydration.

use crate::chart::Rendered;
use crate::dashboard::{Card, Dashboard, Filter};
use crate::theme::Theme;
use crate::value::Row;
use crate::views::frame::ChartElement;

pub fn DashboardView(dashboard: &Dashboard, rows: &[Row], cards: &[Card], payload: &str) -> Element {
    <div class="d3s-root" data-d3s-dashboard="" data-d3s-theme={dashboard.theme.name} style={dashboard.theme.css_vars()}>
        <div class="d3s-header">
            <div>
                if !dashboard.filters.is_empty() {
                    <div class="d3s-filters">
                        for f in &dashboard.filters {
                            <FilterControl filter={f} rows={rows} />
                        }
                        <button type="button" class="d3s-filter-reset">Reset</button>
                    </div>
                }
            </div>
            <div class="d3s-controls">
                if dashboard.time_field.is_some() {
                    <div class="d3s-segmented" role="group" aria-label="Time window">
                        for w in ["5m", "15m", "1h", "6h", "1d", "all"] {
                            <button type="button" data-window={w} aria-pressed={pressed(dashboard, w)}>{window_label(w)}</button>
                        }
                    </div>
                    <button type="button" class="d3s-pause">Pause</button>
                }
                <span class="d3s-status" data-state="idle">{status(dashboard)}</span>
            </div>
        </div>
        <div class="d3s-chips" hidden></div>
        <div class="d3s-grid">
            for card in cards {
                <section class="d3s-card" { ...[("data-span", span(card))] }>
                    if card.title.is_some() {
                        <h3>{title(card)}</h3>
                    }
                    <ChartElement chart={&card.chart} />
                </section>
            }
        </div>
        <script type="application/json" class="d3s-payload">{!payload}</script>
    </div>
}

pub fn Figure(theme: &Theme, chart: &Rendered, payload: &str) -> Element {
    <figure class="d3s-figure" data-d3s-chart="" data-d3s-theme={theme.name} style={theme.css_vars()}>
        <ChartElement chart={chart} />
        if !payload.is_empty() {
            <script type="application/json" class="d3s-payload">{!payload}</script>
        }
    </figure>
}

fn FilterControl(filter: &Filter, rows: &[Row]) -> Element {
    <label class="d3s-filter" data-filter={filter.id()}>
        <span>{filter.label()}</span>
        match filter {
            Filter::Select { multiple, .. } => <select multiple?={*multiple}>
                if !*multiple {
                    <option value="">All</option>
                }
                for o in filter.option_values(rows) {
                    <option value={&o}>{o}</option>
                }
            </select>,
            Filter::Search { .. } => <input type="search" placeholder="Search…">,
            Filter::Range { .. } => <div style="display: flex; gap: 4px;">
                <input type="number" placeholder="Min" style="width: 6em;">
                <input type="number" placeholder="Max" style="width: 6em;">
            </div>,
            Filter::DateRange { .. } => <div style="display: flex; gap: 4px;">
                <input type="date" placeholder="From">
                <input type="date" placeholder="To">
            </div>,
        }
    </label>
}

fn pressed(d: &Dashboard, w: &str) -> &'static str {
    if d.time_window.as_deref().unwrap_or("all") == w { "true" } else { "false" }
}

fn window_label(w: &str) -> &str {
    if w == "all" { "All" } else { w }
}

fn status(d: &Dashboard) -> &'static str {
    if d.stream.is_some() { "Connecting" } else { "Static" }
}

fn span(card: &Card) -> Option<String> {
    (card.span > 1).then(|| card.span.to_string())
}

fn title(card: &Card) -> &str {
    card.title.as_deref().unwrap_or_default()
}
