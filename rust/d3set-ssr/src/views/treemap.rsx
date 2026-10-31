use crate::charts::treemap::Leaf;
use crate::path::raw;
use crate::views::frame::Svg;

pub fn Treemap(width: f64, height: f64, leaves: &[Leaf], radius: f64) -> Element {
    <Svg width={width} height={height}>
        <g>
            for l in leaves {
                <g class="d3s-leaf" style="cursor: pointer;" transform={&l.transform}>
                    <rect opacity="1" rx={raw(radius)} width={&l.width} height={&l.height} style={format!("fill: {};", l.fill)}></rect>
                    <clipPath id={&l.clip_id}><rect width={&l.width} height={&l.height}></rect></clipPath>
                    <text class="d3s-label" clip-path={clip_url(&l.clip_id)} x="6" y="16" style={text_style(l.text_fill)}>{l.label}</text>
                </g>
            }
        </g>
    </Svg>
}

fn clip_url(id: &str) -> String {
    format!("url(#{id})")
}

fn text_style(fill: &str) -> String {
    format!("fill: {fill};")
}
