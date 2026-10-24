//! The gallery's chart theme: documentation-style ink, blurple accent, and a calm palette.
//! It travels to the browser in each payload, so the server is the only place it is defined.

use d3set_ssr::{Theme, LIGHT};

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
    ..LIGHT
};
