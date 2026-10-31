use crate::charts::pie::Slice;
use crate::views::frame::Svg;

pub fn Pie(width: f64, height: f64, transform: String, slices: &[Slice]) -> Element {
    <Svg width={width} height={height}>
        <g transform={transform}>
            for s in slices {
                <path opacity="1" stroke-width="1" d={&s.d} style={format!("fill: {}; stroke: var(--d3s-surface); cursor: pointer;", s.fill)}></path>
            }
        </g>
    </Svg>
}
