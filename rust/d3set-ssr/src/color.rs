//! Colors: Lab interpolation (`d3.interpolateLab`), sequential scales, and stable series colors.

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

/// `d3.scaleSequential(d3.interpolateLab(...theme.color.sequential)).domain(domain)`.
pub fn sequential(theme: &Theme, domain: [f64; 2], x: f64) -> String {
    let [a, b] = domain;
    // d3.scaleSequential maps a collapsed domain to the middle of the interpolator.
    let t = if a == b { 0.5 } else { (x - a) / (b - a) };
    interpolate_lab(theme.sequential[0], theme.sequential[1], t).css()
}

/// Readable text on a fill, like `textOn` in the TypeScript library.
pub fn text_on(fill: &str) -> &'static str {
    let c = if let Some(rest) = fill.strip_prefix("rgb(") {
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
        Rgb::hex(fill)
    };
    if c.lightness() > 0.6 {
        "#111"
    } else {
        "#fff"
    }
}

/// Series colors as the browser assigns them on a first render: keys in name order get the palette in order.
/// The TypeScript `stableColors` keeps these assignments when live data adds keys later.
pub struct SeriesColors<'t> {
    keys: Vec<String>,
    palette: &'t [&'static str],
}

impl<'t> SeriesColors<'t> {
    pub fn new(theme: &'t Theme, keys: &[String]) -> Self {
        let mut keys = keys.to_vec();
        keys.sort_by(|a, b| crate::agg::by_name(a, b));
        keys.dedup();
        Self {
            keys,
            palette: theme.series,
        }
    }

    pub fn get(&self, key: &str) -> &'static str {
        let i = self
            .keys
            .iter()
            .position(|k| k == key)
            .unwrap_or(self.keys.len());
        self.palette[i % self.palette.len()]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
