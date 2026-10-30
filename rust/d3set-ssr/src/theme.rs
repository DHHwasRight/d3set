//! Design tokens: the same values as `lightTheme` and `darkTheme` in the TypeScript library.

pub struct Theme {
    pub name: &'static str,
    pub font_family: &'static str,
    pub font_axis: u32,
    pub font_label: u32,
    pub font_title: u32,
    pub background: &'static str,
    pub surface: &'static str,
    pub text: &'static str,
    pub text_muted: &'static str,
    pub grid: &'static str,
    pub axis: &'static str,
    pub accent: &'static str,
    pub positive: &'static str,
    pub warning: &'static str,
    pub negative: &'static str,
    pub series: &'static [&'static str],
    /// Fixed colors for series by name (TS `color.named`). Other series take `series` in order.
    pub named: &'static [(&'static str, &'static str)],
    pub sequential: [&'static str; 2],
    pub space_sm: u32,
    pub space_md: u32,
    pub radius: f64,
    pub motion: u32,
}

pub const LIGHT: Theme = Theme {
    name: "light",
    font_family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    font_axis: 11,
    font_label: 12,
    font_title: 14,
    background: "#ffffff",
    surface: "#f7f7f8",
    text: "#1a1a1f",
    text_muted: "#6b6b76",
    grid: "#e6e6ea",
    axis: "#9a9aa5",
    accent: "#4f46e5",
    positive: "#059669",
    warning: "#d97706",
    negative: "#dc2626",
    series: &[
        "#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#64748b",
    ],
    named: &[],
    sequential: ["#eef2ff", "#3730a3"],
    space_sm: 8,
    space_md: 16,
    radius: 6.0,
    motion: 250,
};

pub const DARK: Theme = Theme {
    name: "dark",
    background: "#111114",
    surface: "#1b1b20",
    text: "#ececf1",
    text_muted: "#9a9aa5",
    grid: "#2a2a31",
    axis: "#5c5c66",
    accent: "#818cf8",
    positive: "#34d399",
    warning: "#fbbf24",
    negative: "#f87171",
    series: &[
        "#818cf8", "#38bdf8", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#94a3b8",
    ],
    sequential: ["#1e1b4b", "#a5b4fc"],
    ..LIGHT
};

impl Theme {
    /// The `--d3s-*` custom properties, as `applyTheme` sets them, for a `style` attribute.
    pub fn css_vars(&self) -> String {
        let mut s = format!(
            "--d3s-font:{};--d3s-font-axis:{}px;--d3s-font-label:{}px;--d3s-font-title:{}px;\
             --d3s-bg:{};--d3s-surface:{};--d3s-text:{};--d3s-text-muted:{};--d3s-grid:{};--d3s-axis:{};\
             --d3s-accent:{};--d3s-positive:{};--d3s-warning:{};--d3s-negative:{};\
             --d3s-radius:{}px;--d3s-space-sm:{}px;--d3s-space-md:{}px",
            self.font_family,
            self.font_axis,
            self.font_label,
            self.font_title,
            self.background,
            self.surface,
            self.text,
            self.text_muted,
            self.grid,
            self.axis,
            self.accent,
            self.positive,
            self.warning,
            self.negative,
            self.radius,
            self.space_sm,
            self.space_md
        );
        for (i, c) in self.series.iter().enumerate() {
            s.push_str(&format!(";--d3s-series-{i}:{c}"));
        }
        s
    }
}
