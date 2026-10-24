use crate::charts::kpi::Trend;

pub fn Kpi(value: &str, color: Option<&str>, delta: &str, direction: Option<&str>, trend: Option<&Trend>) -> Element {
    <>
        <div class="d3s-kpi-value" { ...[("style", color_style(color).as_deref())] }>{value}</div>
        <div class="d3s-kpi-delta" { ...[("data-trend", direction)] }>{delta}</div>
        if let Some(t) = trend {
            <svg class="d3s-kpi-trend" preserveAspectRatio="none" viewBox="0 0 100 30">
                <path class="area" fill="var(--d3s-accent)" fill-opacity="0.12" { ...[("d", t.area.as_deref())] }></path>
                <path class="line" fill="none" stroke="var(--d3s-accent)" stroke-width="1.5" vector-effect="non-scaling-stroke" { ...[("d", t.line.as_deref())] }></path>
            </svg>
        }
    </>
}

fn color_style(color: Option<&str>) -> Option<String> {
    color.map(|c| format!("color: {c};"))
}
