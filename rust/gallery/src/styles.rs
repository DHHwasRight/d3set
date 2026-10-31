//! The gallery's look, as far as the server needs it: the chart tokens, and the sizes that let it
//! draw a chart at the width the page's CSS will give it.

use d3set_ssr::Theme;

/// Chart tokens; they travel to the browser in every payload.
pub fn theme() -> &'static Theme {
    &crate::theme::GALLERY
}

/// Padding of `.figure` on chart pages (CSS), to size charts like the browser will.
pub const FIGURE_PADDING: f64 = 24.0;

/// giallo theme for code blocks in dark mode.
pub const CODE_THEME: &str = "night-owl";
/// The code theme in light mode: the same palette on a light background. giallo writes each
/// color as `light-dark(light, dark)`, so the page's color scheme picks one, with no script.
pub const CODE_THEME_LIGHT: &str = "night-owl-light";

/// Chart width in the content column: 760px column, minus the figure padding and 1px border on both sides.
pub fn page_chart_width() -> f64 {
    760.0 - 2.0 * (FIGURE_PADDING + 1.0)
}
