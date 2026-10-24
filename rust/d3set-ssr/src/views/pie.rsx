use crate::charts::pie::Slice;
use crate::views::frame::Svg;

pub fn Pie(width: f64, height: f64, transform: String, slices: &[Slice]) -> Element {
    <Svg width={width} height={height}>
        <g transform={transform}>
            for s in slices {
                <path fill={s.fill} opacity="1" style="cursor: pointer;" stroke="var(--d3s-surface)" stroke-width="1" d={&s.d}></path>
            }
        </g>
    </Svg>
}
