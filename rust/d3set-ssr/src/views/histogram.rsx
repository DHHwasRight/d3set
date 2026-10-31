use crate::axis::XYAxes;
use crate::chart::Margin;
use crate::charts::histogram::HistRect;
use crate::views::frame::{Svg, XY};

pub fn Histogram(width: f64, height: f64, axes: &XYAxes, margin: Margin, rects: &[HistRect]) -> Element {
    <Svg width={width} height={height}>
        <XY axes={axes} margin={margin}>
            <g>
                for r in rects {
                    <rect x={&r.x} width={&r.width} y={&r.y} height={&r.height} style="fill: var(--d3s-accent);"></rect>
                }
            </g>
        </XY>
    </Svg>
}
