use crate::axis::XYAxes;
use crate::chart::Margin;
use crate::charts::timeheatmap::TimeCell;
use crate::views::frame::{Svg, XY};

pub fn TimeHeatmap(width: f64, height: f64, axes: &XYAxes, margin: Margin, cells: &[TimeCell]) -> Element {
    <Svg width={width} height={height}>
        <XY axes={axes} margin={margin}>
            <g>
                for c in cells {
                    <rect x={&c.x} width={&c.width} y={&c.y} height={&c.height} fill={&c.fill}></rect>
                }
            </g>
        </XY>
    </Svg>
}
