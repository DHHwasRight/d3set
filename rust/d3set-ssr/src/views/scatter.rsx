use crate::axis::XYAxes;
use crate::chart::Margin;
use crate::charts::scatter::ScatterDot;
use crate::views::frame::{Svg, XY};

pub fn Scatter(
    width: f64,
    height: f64,
    axes: &XYAxes,
    margin: Margin,
    dots: &[ScatterDot],
    fill_opacity: &'static str,
) -> Element {
    <>
    <Svg width={width} height={height}>
        <XY axes={axes} margin={margin}>
            <g>
                for d in dots {
                    <circle r={&d.r} fill-opacity={fill_opacity} opacity="1" cx={&d.cx} cy={&d.cy} style={format!("fill: {}; stroke: {};", d.color, d.color)}></circle>
                }
            </g>
        </XY>
    </Svg>
    </>
}
