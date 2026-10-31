use crate::charts::sunburst::Ring;
use crate::views::frame::Svg;

pub fn Sunburst(width: f64, height: f64, transform: String, arcs: &[Ring]) -> Element {
    <Svg width={width} height={height}>
        <g transform={transform}>
            for a in arcs {
                <path fill-opacity={a.fill_opacity} opacity="1" d={&a.d} style={format!("fill: {}; cursor: pointer;", a.fill)}></path>
            }
        </g>
    </Svg>
}
