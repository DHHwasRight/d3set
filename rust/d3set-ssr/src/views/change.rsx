use crate::charts::change::ChangeRow;

pub fn Change(series: &str, window: &str, rows: &[ChangeRow]) -> Element {
    <div class="d3s-scroll d3s-change">
        <div class="d3s-change-head">
            <span>{series}</span>
            <span>Now</span>
            <span>{previous(window)}</span>
        </div>
        for r in rows {
            <div class="d3s-change-row" title={r.title} { ...[("style", r.style)] }>
                <span class="d3s-change-name">{r.name}</span>
                <span class="d3s-change-now">{r.now}</span>
                <span class="d3s-change-delta" { ...[("style", r.delta_style.as_deref())] }>{r.delta}</span>
            </div>
        }
    </div>
}

fn previous(window: &str) -> String {
    format!("vs previous {window}")
}
