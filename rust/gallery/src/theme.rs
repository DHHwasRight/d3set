//! The gallery's chart theme: documentation-style ink, blurple accent, and a calm palette.
//! It travels to the browser in each payload, so the server is the only place it is defined.

use d3set_ssr::{Colors, Theme, DARK_COLORS, LIGHT};

/// The dark colors, written beside the light ones as `light-dark()` pairs: the page's
/// `color-scheme` picks one, so the theme switch draws nothing again. The surfaces match the
/// gallery's dark tokens (`--page`, `--surface` in `_gallery.css`); the series keep the light
/// palette's hues, lighter, for contrast on the navy surface.
static GALLERY_DARK: Colors = Colors {
    background: "#0a1929",
    surface: "#0d1e31",
    text: "#f6f9fc",
    text_muted: "#8d9aab",
    grid: "#1d2f45",
    axis: "#4d5f78",
    accent: "#9d97ff",
    positive: "#3ecf8e",
    warning: "#f2a33a",
    negative: "#ff5c7a",
    series: &[
        "#9d97ff", "#3cc4f5", "#3ecf8e", "#f7b955", "#ff5c7a", "#c08bff", "#adbdcc",
    ],
    sequential: ["#241f57", "#b8b3ff"],
    ..DARK_COLORS
};

pub static GALLERY: Theme = Theme {
    name: "gallery",
    font_family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif",
    background: "#ffffff",
    surface: "#ffffff",
    text: "#0a2540",
    text_muted: "#5b6b82",
    grid: "#e6ebf1",
    axis: "#a3acb9",
    accent: "#635bff",
    positive: "#0e8a5f",
    warning: "#c46a00",
    negative: "#df1b41",
    series: &["#635bff", "#00a8e8", "#0e8a5f", "#f5a524", "#df1b41", "#a960ee", "#0a2540"],
    sequential: ["#efedff", "#3a32b8"],
    radius: 6.0,
    dark: Some(&GALLERY_DARK),
    ..LIGHT
};
