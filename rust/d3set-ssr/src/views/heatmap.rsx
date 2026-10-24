// The heatmap draws its own x axis: the TS chart hides some labels with a tick opacity of 0.

use crate::axis::{Axis, XYAxes};
use crate::chart::Margin;
use crate::charts::heatmap::HeatCell;
use crate::views::frame::{translate, AxisG, Svg};

pub fn Heatmap(
    width: f64,
    height: f64,
    axes: &XYAxes,
    margin: Margin,
    tick_opacity: &[&'static str],
    cells: &[HeatCell],
    cell_width: String,
    cell_height: String,
    radius: String,
) -> Element {
    <Svg width={width} height={height}>
        <g transform={translate(margin.left, margin.top)}>
            <AxisG axis={&axes.grid} />
            <XAxisG axis={&axes.x} opacity={tick_opacity} />
            <AxisG axis={&axes.y} />
            <g class="d3s-plot">
                for c in cells {
                    <rect x={&c.x} y={&c.y} width={&cell_width} height={&cell_height} rx={&radius} opacity={c.opacity} fill={&c.fill}></rect>
                }
            </g>
        </g>
    </Svg>
}

/// `AxisG` for a bottom axis, with one opacity per tick.
fn XAxisG(axis: &Axis, opacity: &[&'static str]) -> Element {
    <g class={axis.class} { ...[("transform", axis.transform.as_deref())] } fill="none" font-size="10" font-family="sans-serif" text-anchor={axis.anchor()}>
        if axis.domain.is_some() {
            <path class="domain" stroke="currentColor" d={domain(axis)}></path>
        }
        for (i, t) in axis.ticks.iter().enumerate() {
            <g class="tick" opacity={tick_opacity(opacity, i)} transform={&t.transform}>
                <line stroke="currentColor" y2={axis.line_end()}></line>
                <text fill="currentColor" y={axis.text_offset()} dy={axis.dy()}>{t.label}</text>
            </g>
        }
    </g>
}

fn tick_opacity(opacity: &[&'static str], i: usize) -> &'static str {
    opacity.get(i).copied().unwrap_or("1")
}

fn domain(axis: &Axis) -> &str {
    axis.domain.as_deref().unwrap_or_default()
}
