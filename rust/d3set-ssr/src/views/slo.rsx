use crate::charts::slo::Slo as Data;

pub fn Slo(slo: &Data) -> Element {
    <>
        <div class="d3s-kpi-value" { ...[("style", color_style(slo.value_color).as_deref())] }>{slo.value}</div>
        <div class="d3s-slo-meta">{slo.meta}</div>
        <div class="d3s-slo-budget"><div class="d3s-slo-budget-fill" { ...[("style", slo.fill_style.as_deref())] }></div></div>
    </>
}

fn color_style(color: Option<&str>) -> Option<String> {
    color.map(|c| format!("color: {c};"))
}
