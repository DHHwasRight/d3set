use crate::chart::Margin;
use crate::charts::funnel::Stage;
use crate::path::raw;
use crate::views::frame::Svg;

pub fn Funnel(width: f64, height: f64, margin: Margin, stages: &[Stage], bandwidth: f64, mid: f64, radius: f64) -> Element {
    <Svg width={width} height={height}>
        <g transform={translate(margin)}>
            for s in stages {
                <g class="d3s-stage" transform={&s.transform} opacity="1" style="cursor: pointer;">
                    <rect x={&s.x} width={&s.width} height={raw(bandwidth)} rx={raw(radius)} fill={s.fill}></rect>
                    <text class="d3s-label" text-anchor="middle" dy="0.35em" x={raw(mid)} y={raw(bandwidth / 2.0)} style={text_style(s.text_fill)}>{s.label}</text>
                </g>
            }
        </g>
    </Svg>
}

fn translate(m: Margin) -> String {
    format!("translate({},{})", raw(m.left), raw(m.top))
}

fn text_style(fill: &str) -> String {
    format!("fill: {fill};")
}
