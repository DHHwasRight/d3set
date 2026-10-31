use crate::charts::gauge::GaugeView;
use crate::views::frame::Svg;

pub fn Gauge(width: f64, height: f64, g: &GaugeView) -> Element {
    <Svg width={width} height={height}>
        <g transform={&g.transform}>
            <path d={&g.track} style="fill: var(--d3s-grid);"></path>
            <path d={&g.bar} style={format!("fill: {};", &g.fill)}></path>
            <g>
                for t in &g.ticks {
                    <line stroke-width="3" x1={&t.x1} y1={&t.y1} x2={&t.x2} y2={&t.y2} style={format!("stroke: {};", &t.stroke)}></line>
                }
            </g>
            <text class="d3s-label" text-anchor="middle" y={&g.label_y} style={&g.label_style}>{g.label}</text>
            <text class="d3s-label-muted" text-anchor="middle" x={&g.low_x} y="14">{g.low}</text>
            <text class="d3s-label-muted" text-anchor="middle" x={&g.high_x} y="14">{g.high}</text>
        </g>
    </Svg>
}
