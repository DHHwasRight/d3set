// Markup of line, area, and timeseries charts: one `<g>` of marks, then the threshold markers.

use crate::axis::XYAxes;
use crate::chart::Margin;
use crate::charts::xy::Marker;
use crate::views::frame::{Svg, XY};

/// One line or area path.
pub struct PathMark {
    pub d: String,
    pub fill: String,
    pub fill_opacity: Option<String>,
    pub stroke: String,
    pub stroke_width: String,
}

/// One time bar.
pub struct RectMark {
    pub x: String,
    pub y: String,
    pub width: String,
    pub height: String,
    pub fill: String,
}

pub fn XYChart(width: f64, height: f64, axes: &XYAxes, margin: Margin, paths: &[PathMark], rects: &[RectMark], markers: &[Marker]) -> Element {
    <Svg width={width} height={height}>
        <XY axes={axes} margin={margin}>
            <g>
                for p in paths {
                    <path fill={&p.fill} { ...[("fill-opacity", p.fill_opacity.as_deref())] } stroke={&p.stroke} stroke-width={&p.stroke_width} d={&p.d}></path>
                }
                for r in rects {
                    <rect x={&r.x} y={&r.y} height={&r.height} fill={&r.fill} width={&r.width}></rect>
                }
            </g>
            for m in markers {
                <g class="d3s-marker" pointer-events="none" transform={&m.transform}>
                    <line stroke-dasharray="4 3" stroke-width="1.5" x2={&m.x2} stroke={&m.color}></line>
                    <text class="d3s-label-muted" text-anchor="end" dy="-0.35em" x={&m.x2} style={fill_style(&m.color)}>{m.label}</text>
                </g>
            }
        </XY>
    </Svg>
}

fn fill_style(color: &str) -> String {
    format!("fill: {color};")
}
