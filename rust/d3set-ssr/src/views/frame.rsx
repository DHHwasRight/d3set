// Shared markup: the chart element and its legend, the SVG frame, and d3-axis groups.
// The structure and classes match what the TypeScript library builds, so the same CSS
// styles both and hydration swaps like for like.

use crate::axis::{Axis, Orient, XYAxes};
use crate::chart::{Margin, Rendered};
use crate::path::n;

pub fn ChartElement(chart: &Rendered) -> Element {
    <>
        <div class={chart_class(chart)} style={chart_style(chart)}>{!chart.body}</div>
        if chart.has_legend || !chart.legend.is_empty() {
            <div class="d3s-legend" hidden?={legend_hidden(chart)}>
                for item in &chart.legend {
                    <button type="button" class="d3s-legend-item" aria-pressed="true" title="Click: show only this. Shift-click: hide or show.">
                        <i style={swatch(&item.color)}></i>
                        {item.key}
                    </button>
                }
            </div>
        }
    </>
}

fn chart_class(chart: &Rendered) -> String {
    if chart.plain {
        chart.class.to_string()
    } else if chart.class.is_empty() {
        "d3s-chart".to_string()
    } else {
        format!("d3s-chart {}", chart.class)
    }
}

fn chart_style(chart: &Rendered) -> String {
    if chart.plain {
        chart.style.clone()
    } else {
        format!("height: {}px;{}", n(chart.height), chart.style)
    }
}

fn legend_hidden(chart: &Rendered) -> bool {
    chart.legend.len() <= 1 && !chart.force_legend
}

fn swatch(color: &str) -> String {
    format!("background: {color};")
}

/// The chart's SVG. It scales down to narrower cards than the server assumed; the browser redraws at the real size.
pub fn Svg(width: f64, height: f64, children: Element) -> Element {
    <svg width="100%" height={n(height)} viewBox={view_box(width, height)} preserveAspectRatio="xMinYMin meet">
        {children}
    </svg>
}

fn view_box(width: f64, height: f64) -> String {
    format!("0 0 {} {}", n(width), n(height))
}

/// The layers of an x/y chart: grid lines, x axis, y axis, then the plot on top.
pub fn XY(axes: &XYAxes, margin: Margin, children: Element) -> Element {
    <g transform={translate(margin.left, margin.top)}>
        <AxisG axis={&axes.grid} />
        <AxisG axis={&axes.x} />
        <AxisG axis={&axes.y} />
        <g class="d3s-plot">{children}</g>
    </g>
}

pub fn translate(x: f64, y: f64) -> String {
    format!("translate({},{})", n(x), n(y))
}

pub fn AxisG(axis: &Axis) -> Element {
    if axis.bare {
        <g class={axis.class}></g>
    } else {
    <g class={axis.class} { ...[("transform", axis.transform.as_deref())] } fill="none" font-size="10" font-family="sans-serif" text-anchor={axis.anchor()}>
        if axis.domain.is_some() {
            <path class="domain" stroke="currentColor" d={domain(axis)}></path>
        }
        for t in &axis.ticks {
            <g class="tick" opacity="1" transform={&t.transform}>
                if axis.orient == Orient::Bottom {
                    <line stroke="currentColor" y2={axis.line_end()}></line>
                    <text fill="currentColor" y={axis.text_offset()} dy={axis.dy()} { ...[("text-anchor", t.anchor)] }>{t.label}</text>
                } else {
                    <line stroke="currentColor" x2={axis.line_end()}></line>
                    <text fill="currentColor" x={axis.text_offset()} dy={axis.dy()}>{t.label}</text>
                }
            </g>
        }
    </g>
    }
}

fn domain(axis: &Axis) -> &str {
    axis.domain.as_deref().unwrap_or_default()
}
