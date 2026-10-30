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
    pub stroke_width: Option<String>,
}

/// One area gradient (`options.gradient`): the series color from opacity 0.4 at the top to 0 at 60%.
pub struct Gradient {
    pub id: String,
    pub color: String,
}

/// One time bar.
pub struct RectMark {
    pub x: String,
    pub y: String,
    pub width: String,
    pub height: String,
    pub fill: String,
}

pub fn XYChart(width: f64, height: f64, axes: &XYAxes, margin: Margin, gradients: Option<&[Gradient]>, paths: &[PathMark], lines: Option<&[PathMark]>, rects: &[RectMark], markers: &[Marker]) -> Element {
    <Svg width={width} height={height}>
        <XY axes={axes} margin={margin}>
            if let Some(gradients) = gradients {
                <defs>
                    for g in gradients {
                        <linearGradient x1="0" y1="0" x2="0" y2="1" id={&g.id}>
                            <stop offset="0%" stop-opacity="0.4" stop-color={&g.color}></stop>
                            <stop offset="60%" stop-opacity="0" stop-color={&g.color}></stop>
                        </linearGradient>
                    }
                </defs>
            }
            <g>
                for p in paths {
                    <path fill={&p.fill} { ...[("fill-opacity", p.fill_opacity.as_deref())] } stroke={&p.stroke} { ...[("stroke-width", p.stroke_width.as_deref())] } d={&p.d}></path>
                }
                for r in rects {
                    <rect x={&r.x} y={&r.y} height={&r.height} fill={&r.fill} width={&r.width}></rect>
                }
            </g>
            if let Some(lines) = lines {
                <g>
                    for l in lines {
                        <path class="d3s-area-line" fill={&l.fill} stroke={&l.stroke} { ...[("stroke-width", l.stroke_width.as_deref())] } d={&l.d}></path>
                    }
                </g>
            }
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
