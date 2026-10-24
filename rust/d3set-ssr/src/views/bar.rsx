use crate::axis::XYAxes;
use crate::chart::Margin;
use crate::charts::bar::BarRect;
use crate::path::raw;
use crate::views::frame::{Svg, XY};

pub fn Bar(width: f64, height: f64, axes: &XYAxes, margin: Margin, rects: &[BarRect], radius: f64) -> Element {
    <Svg width={width} height={height}>
        <XY axes={axes} margin={margin}>
            for r in rects {
                <rect x={&r.x} y={&r.y} width={&r.width} height={&r.height} rx={raw(radius)} fill={r.fill} opacity="1">
                    <title>{r.title}</title>
                </rect>
            }
        </XY>
    </Svg>
}
