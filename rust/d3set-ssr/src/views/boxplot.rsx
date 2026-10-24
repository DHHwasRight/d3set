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
                    <line class="whisker" stroke="var(--d3s-axis)" x1={&half} x2={&half} y1={&b.whisker_y1} y2={&b.whisker_y2}></line>
                    <rect fill={b.color} fill-opacity="0.35" stroke={b.color} rx={&radius} width={&bandwidth} y={&b.y} height={&b.height}></rect>
                    <line class="median" stroke={b.color} stroke-width="2" x2={&bandwidth} y1={&b.median} y2={&b.median}></line>
                    for cy in &b.outliers {
                        <circle cx={&half} cy={cy} r="2.5" fill="none" stroke="var(--d3s-text-muted)"></circle>
                    }
                </g>
            }
        </XY>
    </Svg>
}
