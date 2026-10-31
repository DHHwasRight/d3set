//! Colors: Lab interpolation (`d3.interpolateLab`), sequential scales, and stable series colors.
//!
//! Every color a chart draws is a CSS var (`var(--d3s-series-0)`) or a mix of them, the same
//! strings the TypeScript library writes. The theme's vars hold `light-dark(…)` pairs, so a chart
//! follows the page's `color-scheme` with no redraw.

use crate::theme::Theme;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rgb(pub f64, pub f64, pub f64);

impl Rgb {
    /// `#rgb` or `#rrggbb`. Anything else is black.
    pub fn hex(s: &str) -> Self {
        let h = s.trim_start_matches('#');
        let v = |i: usize, n: usize| u8::from_str_radix(&h[i..i + n], 16).map_or(0.0, f64::from);
        match h.len() {
            3 => Rgb(v(0, 1) * 17.0, v(1, 1) * 17.0, v(2, 1) * 17.0),
            6 => Rgb(v(0, 2), v(2, 2), v(4, 2)),
            _ => Rgb(0.0, 0.0, 0.0),
        }
    }

    /// `rgb(r, g, b)`, the string d3 writes.
    pub fn css(self) -> String {
        let c = |x: f64| x.round().clamp(0.0, 255.0) as u8;
        format!("rgb({}, {}, {})", c(self.0), c(self.1), c(self.2))
    }

    /// HSL lightness in [0, 1].
    pub fn lightness(self) -> f64 {
        let max = self.0.max(self.1).max(self.2);
        let min = self.0.min(self.1).min(self.2);
        (max + min) / 2.0 / 255.0
    }
}

const XN: f64 = 0.96422;
const YN: f64 = 1.0;
const ZN: f64 = 0.82521;
const T0: f64 = 4.0 / 29.0;
const T1: f64 = 6.0 / 29.0;
const T2: f64 = 3.0 * T1 * T1;
const T3: f64 = T1 * T1 * T1;

fn rgb2lrgb(x: f64) -> f64 {
    let x = x / 255.0;
    if x <= 0.04045 {
        x / 12.92
    } else {
        ((x + 0.055) / 1.055).powf(2.4)
    }
}
fn lrgb2rgb(x: f64) -> f64 {
    255.0
        * if x <= 0.0031308 {
            12.92 * x
        } else {
            1.055 * x.powf(1.0 / 2.4) - 0.055
        }
}
fn xyz2lab(t: f64) -> f64 {
    if t > T3 {
        t.powf(1.0 / 3.0)
    } else {
        t / T2 + T0
    }
}
fn lab2xyz(t: f64) -> f64 {
    if t > T1 {
        t * t * t
    } else {
        T2 * (t - T0)
    }
}

fn to_lab(c: Rgb) -> [f64; 3] {
    let (r, g, b) = (rgb2lrgb(c.0), rgb2lrgb(c.1), rgb2lrgb(c.2));
    let y = xyz2lab((0.2225045 * r + 0.7168786 * g + 0.0606169 * b) / YN);
    let (x, z) = if r == g && g == b {
        (y, y)
    } else {
        (
            xyz2lab((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / XN),
            xyz2lab((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / ZN),
        )
    };
    [116.0 * y - 16.0, 500.0 * (x - y), 200.0 * (y - z)]
}

fn from_lab([l, a, b]: [f64; 3]) -> Rgb {
    let y = (l + 16.0) / 116.0;
    let x = XN * lab2xyz(y + a / 500.0);
    let z = ZN * lab2xyz(y - b / 200.0);
    let y = YN * lab2xyz(y);
    Rgb(
        lrgb2rgb(3.1338561 * x - 1.6168667 * y - 0.4906146 * z),
        lrgb2rgb(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z),
        lrgb2rgb(0.0719453 * x - 0.2289914 * y + 1.4052427 * z),
    )
}

/// `d3.interpolateLab(a, b)(t)`.
pub fn interpolate_lab(a: &str, b: &str, t: f64) -> Rgb {
    let (la, lb) = (to_lab(Rgb::hex(a)), to_lab(Rgb::hex(b)));
    from_lab([
        la[0] + (lb[0] - la[0]) * t,
        la[1] + (lb[1] - la[1]) * t,
        la[2] + (lb[2] - la[2]) * t,
    ])
}

/// A color of the sequential scale at `t` in [0, 1]: a mix of `--d3s-seq-0` and `--d3s-seq-1`,
/// the share rounded to 0.1 % (TS `seqColor`).
pub fn seq_color(t: f64) -> String {
    // `+ 0.0` turns -0 into 0, which JavaScript prints as "0".
    let p = (t.clamp(0.0, 1.0) * 1000.0).round() / 10.0 + 0.0;
    format!("color-mix(in oklab, var(--d3s-seq-1) {p}%, var(--d3s-seq-0))")
}

/// The sequential scale over `domain` at `x` (TS `sequentialColor`). A collapsed domain maps to
/// the middle, like `d3.scaleSequential`.
pub fn sequential(_theme: &Theme, domain: [f64; 2], x: f64) -> String {
    let [a, b] = domain;
    seq_color(if a == b { 0.5 } else { (x - a) / (b - a) })
}

/// A status color, as a CSS var (TS `levelColor`).
pub fn level_var(level: crate::spec::Level) -> &'static str {
    match level {
        crate::spec::Level::Ok => "var(--d3s-positive)",
        crate::spec::Level::Warning => "var(--d3s-warning)",
        crate::spec::Level::Critical => "var(--d3s-negative)",
    }
}

/// The color a chart color stands for, in light or dark mode (TS `resolveColor`).
pub fn resolve(theme: &Theme, color: &str, dark: bool) -> String {
    let d = if dark { theme.dark } else { None };
    if let Some(i) = color
        .strip_prefix("var(--d3s-series-")
        .and_then(|r| r.strip_suffix(')'))
        .and_then(|i| i.parse::<usize>().ok())
    {
        return d
            .and_then(|d| d.series.get(i).copied())
            .or_else(|| theme.series.get(i).copied())
            .unwrap_or("#000")
            .to_string();
    }
    if let Some(h) = color
        .strip_prefix("var(--d3s-named-")
        .and_then(|r| r.strip_suffix(')'))
    {
        let Some((name, light)) = theme
            .named
            .iter()
            .find(|(n, _)| crate::charts::xy::fnv1a(n) == h)
        else {
            return "#000".to_string();
        };
        let dark = if dark { theme.dark_named(name) } else { None };
        return dark.unwrap_or(light).to_string();
    }
    if let Some(p) = color
        .strip_prefix("color-mix(in oklab, var(--d3s-seq-1) ")
        .and_then(|r| r.strip_suffix("%, var(--d3s-seq-0))"))
        .and_then(|p| p.parse::<f64>().ok())
    {
        let [a, b] = d.map_or(theme.sequential, |d| d.sequential);
        return interpolate_lab(a, b, p / 100.0).css();
    }
    let token = |light: &'static str, dark: Option<&'static str>| dark.unwrap_or(light).to_string();
    match color {
        "var(--d3s-bg)" => token(theme.background, d.map(|d| d.background)),
        "var(--d3s-surface)" => token(theme.surface, d.map(|d| d.surface)),
        "var(--d3s-text)" => token(theme.text, d.map(|d| d.text)),
        "var(--d3s-text-muted)" => token(theme.text_muted, d.map(|d| d.text_muted)),
        "var(--d3s-grid)" => token(theme.grid, d.map(|d| d.grid)),
        "var(--d3s-axis)" => token(theme.axis, d.map(|d| d.axis)),
        "var(--d3s-accent)" => token(theme.accent, d.map(|d| d.accent)),
        "var(--d3s-positive)" => token(theme.positive, d.map(|d| d.positive)),
        "var(--d3s-warning)" => token(theme.warning, d.map(|d| d.warning)),
        "var(--d3s-negative)" => token(theme.negative, d.map(|d| d.negative)),
        other => other.to_string(),
    }
}

/// Readable text on a fill, in both modes, like `textOn` in the TypeScript library.
pub fn text_on(theme: &Theme, fill: &str) -> &'static str {
    let on = |dark: bool| {
        if parse(&resolve(theme, fill, dark)).lightness() > 0.6 {
            "#111"
        } else {
            "#fff"
        }
    };
    match (on(false), theme.dark.map(|_| on(true))) {
        ("#111", Some("#fff")) => "light-dark(#111, #fff)",
        ("#fff", Some("#111")) => "light-dark(#fff, #111)",
        (light, _) => light,
    }
}

/// `#rgb`, `#rrggbb` or `rgb(r, g, b)`.
fn parse(color: &str) -> Rgb {
    if let Some(rest) = color.strip_prefix("rgb(") {
        let parts: Vec<f64> = rest
            .trim_end_matches(')')
            .split(',')
            .filter_map(|p| p.trim().parse().ok())
            .collect();
        Rgb(
            parts.first().copied().unwrap_or(0.0),
            parts.get(1).copied().unwrap_or(0.0),
            parts.get(2).copied().unwrap_or(0.0),
        )
    } else {
        Rgb::hex(color)
    }
}

/// A `&'static str` for a var. The set is bounded (palette indices and the names a theme fixes),
/// so the strings live as long as the process.
fn intern(s: String) -> &'static str {
    use std::collections::HashSet;
    use std::sync::{Mutex, OnceLock};
    static SET: OnceLock<Mutex<HashSet<&'static str>>> = OnceLock::new();
    let mut set = SET
        .get_or_init(Default::default)
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    if let Some(found) = set.get(s.as_str()) {
        return found;
    }
    let leaked: &'static str = Box::leak(s.into_boxed_str());
    set.insert(leaked);
    leaked
}

/// Series colors as the browser assigns them on a first render: a key the theme names gets its
/// fixed color; the other keys, in name order, get the palette in order.
/// The TypeScript `stableColors` keeps these assignments when live data adds keys later.
pub struct SeriesColors<'t> {
    keys: Vec<String>,
    size: usize,
    named: &'t [(&'static str, &'static str)],
}

impl<'t> SeriesColors<'t> {
    pub fn new(theme: &'t Theme, keys: &[String]) -> Self {
        let mut keys: Vec<String> = keys
            .iter()
            .filter(|k| !theme.named.iter().any(|(n, _)| n == k))
            .cloned()
            .collect();
        keys.sort_by(|a, b| crate::agg::by_name(a, b));
        keys.dedup();
        Self {
            keys,
            size: theme.series.len().max(1),
            named: theme.named,
        }
    }

    /// `var(--d3s-series-<i>)`, or `var(--d3s-named-<hash>)` for a name the theme fixes.
    pub fn get(&self, key: &str) -> &'static str {
        if self.named.iter().any(|(n, _)| *n == key) {
            return intern(format!("var({})", crate::theme::named_var(key)));
        }
        let i = self
            .keys
            .iter()
            .position(|k| k == key)
            .unwrap_or(self.keys.len());
        intern(format!("var(--d3s-series-{})", i % self.size))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn named_series_keep_their_color_and_take_no_palette_slot() {
        let theme = Theme {
            named: &[("Churn", "#dc3309")],
            ..crate::theme::LIGHT
        };
        let keys = ["New", "Churn", "Expansion"].map(String::from);
        let colors = SeriesColors::new(&theme, &keys);
        assert_eq!(
            colors.get("Churn"),
            format!("var({})", crate::theme::named_var("Churn"))
        );
        assert_eq!(colors.get("Expansion"), "var(--d3s-series-0)");
        assert_eq!(colors.get("New"), "var(--d3s-series-1)");
        assert_eq!(resolve(&theme, colors.get("Churn"), false), "#dc3309");
    }

    #[test]
    fn a_sequential_color_is_a_mix_rounded_to_a_tenth_of_a_percent() {
        assert_eq!(
            seq_color(1.0 / 3.0),
            "color-mix(in oklab, var(--d3s-seq-1) 33.3%, var(--d3s-seq-0))"
        );
        assert_eq!(
            seq_color(0.0),
            "color-mix(in oklab, var(--d3s-seq-1) 0%, var(--d3s-seq-0))"
        );
        assert_eq!(
            seq_color(2.0),
            "color-mix(in oklab, var(--d3s-seq-1) 100%, var(--d3s-seq-0))"
        );
    }

    #[test]
    fn text_on_a_fill_follows_both_modes() {
        // Series 0: indigo in light mode, light indigo in dark mode.
        assert_eq!(
            text_on(&crate::theme::LIGHT, "var(--d3s-series-0)"),
            "light-dark(#fff, #111)"
        );
        assert_eq!(text_on(&crate::theme::DARK, "var(--d3s-series-0)"), "#111");
    }

    #[test]
    fn lab_round_trips_and_interpolates_like_d3() {
        assert_eq!(
            interpolate_lab("#eef2ff", "#3730a3", 0.0).css(),
            "rgb(238, 242, 255)"
        );
        assert_eq!(
            interpolate_lab("#eef2ff", "#3730a3", 1.0).css(),
            "rgb(55, 48, 163)"
        );
        // d3.interpolateLab("#eef2ff", "#3730a3")(0.5), from d3 7.9
        assert_eq!(
            interpolate_lab("#eef2ff", "#3730a3", 0.5).css(),
            "rgb(152, 140, 210)"
        );
    }
}
