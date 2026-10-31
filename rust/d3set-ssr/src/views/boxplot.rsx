use crate::axis::XYAxes;
use crate::chart::Margin;
use crate::charts::boxplot::BoxMarks;
use crate::views::frame::{Svg, XY};

pub fn Boxplot(
    width: f64,
    height: f64,
    axes: &XYAxes,
    margin: Margin,
    boxes: &[BoxMarks],
    half: String,
    bandwidth: String,
    radius: String,
) -> Element {
    <Svg width={width} height={height}>
        <XY axes={axes} margin={margin}>
            for b in boxes {
                <g class="d3s-box" opacity="1" transform={&b.transform}>
                    <line class="whisker" x1={&half} x2={&half} y1={&b.whisker_y1} y2={&b.whisker_y2} style="stroke: var(--d3s-axis);"></line>
                    <rect fill-opacity="0.35" rx={&radius} width={&bandwidth} y={&b.y} height={&b.height} style={format!("fill: {}; stroke: {};", b.color, b.color)}></rect>
                    <line class="median" stroke-width="2" x2={&bandwidth} y1={&b.median} y2={&b.median} style={format!("stroke: {};", b.color)}></line>
                    for cy in &b.outliers {
                        <circle cx={&half} cy={cy} r="2.5" fill="none" style="stroke: var(--d3s-text-muted);"></circle>
                    }
                </g>
            }
        </XY>
    </Svg>
}
