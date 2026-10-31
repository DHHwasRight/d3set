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
    /// Colors in dark mode (TS `theme.dark`). Each color var is then
    /// `light-dark(<color>, <dark>)`, so a chart follows the page's CSS `color-scheme` with no
    /// redraw. [`LIGHT`] takes [`DARK_COLORS`]; [`DARK`] has none: it is always dark.
    pub dark: Option<&'static Colors>,
    pub space_sm: u32,
    pub space_md: u32,
    pub radius: f64,
    pub motion: u32,
}

/// The colors of a theme in dark mode: every color of [`Theme`], nothing else.
pub struct Colors {
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
    /// Dark colors for named series. A name it leaves out keeps its light color.
    pub named: &'static [(&'static str, &'static str)],
    pub sequential: [&'static str; 2],
}

/// The colors of [`DARK`]: also the dark mode of [`LIGHT`] (TS `darkTheme.color`).
pub const DARK_COLORS: Colors = Colors {
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
    named: &[],
    sequential: ["#1e1b4b", "#a5b4fc"],
};

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
    dark: Some(&DARK_COLORS),
    space_sm: 8,
    space_md: 16,
    radius: 6.0,
    motion: 250,
};

/// Always dark, whatever the page's `color-scheme`.
pub const DARK: Theme = Theme {
    name: "dark",
    background: DARK_COLORS.background,
    surface: DARK_COLORS.surface,
    text: DARK_COLORS.text,
    text_muted: DARK_COLORS.text_muted,
    grid: DARK_COLORS.grid,
    axis: DARK_COLORS.axis,
    accent: DARK_COLORS.accent,
    positive: DARK_COLORS.positive,
    warning: DARK_COLORS.warning,
    negative: DARK_COLORS.negative,
    series: DARK_COLORS.series,
    sequential: DARK_COLORS.sequential,
    dark: None,
    ..LIGHT
};

/// `light-dark(light, dark)`, or `light` alone when dark mode keeps it (TS `lightDark`).
pub fn light_dark(light: &str, dark: Option<&str>) -> String {
    match dark {
        Some(d) if d != light => format!("light-dark({light}, {d})"),
        _ => light.to_string(),
    }
}

/// The custom property of a series the theme names: `--d3s-named-<fnv1a(name)>` (TS `namedVar`).
pub fn named_var(name: &str) -> String {
    format!("--d3s-named-{}", crate::charts::xy::fnv1a(name))
}

impl Theme {
    /// The `--d3s-*` custom properties, as `applyTheme` sets them, for a `style` attribute.
    pub fn css_vars(&self) -> String {
        let d = self.dark;
        let pair = |light: &str, dark: Option<&str>| light_dark(light, dark);
        let mut s = format!(
            "--d3s-font:{};--d3s-font-axis:{}px;--d3s-font-label:{}px;--d3s-font-title:{}px;\
             --d3s-bg:{};--d3s-surface:{};--d3s-text:{};--d3s-text-muted:{};--d3s-grid:{};--d3s-axis:{};\
             --d3s-accent:{};--d3s-positive:{};--d3s-warning:{};--d3s-negative:{};\
             --d3s-radius:{}px;--d3s-space-sm:{}px;--d3s-space-md:{}px",
            self.font_family,
            self.font_axis,
            self.font_label,
            self.font_title,
            pair(self.background, d.map(|d| d.background)),
            pair(self.surface, d.map(|d| d.surface)),
            pair(self.text, d.map(|d| d.text)),
            pair(self.text_muted, d.map(|d| d.text_muted)),
            pair(self.grid, d.map(|d| d.grid)),
            pair(self.axis, d.map(|d| d.axis)),
            pair(self.accent, d.map(|d| d.accent)),
            pair(self.positive, d.map(|d| d.positive)),
            pair(self.warning, d.map(|d| d.warning)),
            pair(self.negative, d.map(|d| d.negative)),
            self.radius,
            self.space_sm,
            self.space_md
        );
        for (i, c) in self.series.iter().enumerate() {
            let dark = d.and_then(|d| d.series.get(i).copied());
            s.push_str(&format!(";--d3s-series-{i}:{}", pair(c, dark)));
        }
        for (name, c) in self.named {
            s.push_str(&format!(
                ";{}:{}",
                named_var(name),
                pair(c, self.dark_named(name))
            ));
        }
        for (i, c) in self.sequential.iter().enumerate() {
            let dark = d.map(|d| d.sequential[i]);
            s.push_str(&format!(";--d3s-seq-{i}:{}", pair(c, dark)));
        }
        s
    }

    /// The dark color of a named series, when dark mode names it.
    pub fn dark_named(&self, name: &str) -> Option<&'static str> {
        self.dark?
            .named
            .iter()
            .find(|(n, _)| *n == name)
            .map(|(_, c)| *c)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_dark_color_makes_a_light_dark_pair() {
        let vars = LIGHT.css_vars();
        assert!(
            vars.contains("--d3s-bg:light-dark(#ffffff, #111114)"),
            "{vars}"
        );
        assert!(
            vars.contains("--d3s-series-0:light-dark(#4f46e5, #818cf8)"),
            "{vars}"
        );
        assert!(
            vars.contains("--d3s-seq-1:light-dark(#3730a3, #a5b4fc)"),
            "{vars}"
        );
        // Always dark: plain values.
        assert!(DARK.css_vars().contains("--d3s-bg:#111114;"));
    }

    #[test]
    fn a_named_series_gets_its_own_var() {
        static DARKER: Colors = Colors {
            named: &[("Churn", "#ff8866")],
            ..DARK_COLORS
        };
        let theme = Theme {
            named: &[("Churn", "#dc3309"), ("New", "#00aa00")],
            dark: Some(&DARKER),
            ..LIGHT
        };
        let vars = theme.css_vars();
        assert!(vars.contains(&format!(
            "{}:light-dark(#dc3309, #ff8866)",
            named_var("Churn")
        )));
        assert!(vars.contains(&format!("{}:#00aa00", named_var("New"))));
    }
}
