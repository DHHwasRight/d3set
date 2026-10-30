pub fn DashboardPage(title: &str, lead: &str, markup: &str, js: bool, path: &str, rows: usize) -> Element {
    <article class="page page-wide">
        <div class="eyebrow">Dashboards</div>
        <h1>{title}</h1>
        <p class="lead">{lead}</p>
        <div class="callout">
            if js {
                <span class="badge badge-live">Live</span>
                {rows} rows<span data-snippet="rendered">, rendered on the server</span>. Click a bar, slice, row, or tile to cross-filter; drag on a time chart to zoom.
                <a href={off_href(path)} dp-boost="false">View without JavaScript</a>
            } else {
                <span class="badge">Static</span>
                What the server sends: {rows} rows drawn as SVG and HTML, no script.
                <a href={path} dp-boost="false">Turn JavaScript back on</a>
            }
        </div>
        <div class="dashboard">{!markup}</div>
    </article>
}

fn off_href(path: &str) -> String {
    format!("{path}?js=off")
}
