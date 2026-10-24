//! d3-scale ports: linear (with d3-array's tick algorithm and `nice`), band, and UTC time.

use crate::time;

const E10: f64 = 7.0710678118654755; // sqrt(50)
const E5: f64 = 3.1622776601683795; // sqrt(10)
const E2: f64 = std::f64::consts::SQRT_2;

fn tick_spec(start: f64, stop: f64, count: f64) -> (f64, f64, f64) {
    let step = (stop - start) / count.max(0.0);
    let power = step.log10().floor();
    let error = step / 10f64.powf(power);
    let factor = if error >= E10 {
        10.0
    } else if error >= E5 {
        5.0
    } else if error >= E2 {
        2.0
    } else {
        1.0
    };
    let (mut i1, mut i2, inc);
    if power < 0.0 {
        let k = 10f64.powf(-power) / factor;
        i1 = (start * k).round();
        i2 = (stop * k).round();
        if i1 / k < start {
            i1 += 1.0;
        }
        if i2 / k > stop {
            i2 -= 1.0;
        }
        inc = -k;
    } else {
        let k = 10f64.powf(power) * factor;
        i1 = (start / k).round();
        i2 = (stop / k).round();
        if i1 * k < start {
            i1 += 1.0;
        }
        if i2 * k > stop {
            i2 -= 1.0;
        }
        inc = k;
    }
    if i2 < i1 && (0.5..2.0).contains(&count) {
        return tick_spec(start, stop, count * 2.0);
    }
    (i1, i2, inc)
}

/// `d3.ticks(start, stop, count)`.
pub fn ticks(start: f64, stop: f64, count: f64) -> Vec<f64> {
    // NaN counts give no ticks, as in d3.
    if count.is_nan() || count <= 0.0 {
        return vec![];
    }
    if start == stop {
        return vec![start];
    }
    let reverse = stop < start;
    let (a, b) = if reverse {
        (stop, start)
    } else {
        (start, stop)
    };
    let (i1, i2, inc) = tick_spec(a, b, count);
    if i2.is_nan() || i1.is_nan() || i2 < i1 {
        return vec![];
    }
    let n = (i2 - i1 + 1.0) as usize;
    let mut out: Vec<f64> = (0..n)
        .map(|i| {
            let k = i1 + i as f64;
            if inc < 0.0 {
                k / -inc
            } else {
                k * inc
            }
        })
        .collect();
    if reverse {
        out.reverse();
    }
    out
}

/// `d3.tickIncrement`.
pub fn tick_increment(start: f64, stop: f64, count: f64) -> f64 {
    tick_spec(start, stop, count).2
}

/// `d3.tickStep`.
pub fn tick_step(start: f64, stop: f64, count: f64) -> f64 {
    let reverse = stop < start;
    let inc = if reverse {
        tick_increment(stop, start, count)
    } else {
        tick_increment(start, stop, count)
    };
    (if reverse { -1.0 } else { 1.0 }) * if inc < 0.0 { 1.0 / -inc } else { inc }
}

/// `d3.scaleLinear()`.
#[derive(Clone, Debug)]
pub struct Linear {
    pub domain: [f64; 2],
    pub range: [f64; 2],
}

impl Linear {
    pub fn new(domain: [f64; 2], range: [f64; 2]) -> Self {
        Self { domain, range }
    }

    pub fn map(&self, x: f64) -> f64 {
        let [d0, d1] = self.domain;
        let [r0, r1] = self.range;
        if d1 == d0 {
            // d3 maps a collapsed domain to the middle of the range.
            return (r0 + r1) / 2.0;
        }
        r0 + (x - d0) / (d1 - d0) * (r1 - r0)
    }

    pub fn invert(&self, y: f64) -> f64 {
        Linear::new(self.range, self.domain).map(y)
    }

    /// `scale.nice(count)`.
    #[must_use]
    pub fn nice(mut self, count: f64) -> Self {
        let [mut start, mut stop] = self.domain;
        let reverse = stop < start;
        if reverse {
            std::mem::swap(&mut start, &mut stop);
        }
        let mut prestep = f64::NAN;
        for _ in 0..10 {
            let step = tick_increment(start, stop, count);
            if step == prestep {
                // d3 writes the domain only here, when the step settles.
                self.domain = if reverse {
                    [stop, start]
                } else {
                    [start, stop]
                };
                return self;
            } else if step > 0.0 {
                start = (start / step).floor() * step;
                stop = (stop / step).ceil() * step;
            } else if step < 0.0 {
                start = (start * step).ceil() / step;
                stop = (stop * step).floor() / step;
            } else {
                break;
            }
            prestep = step;
        }
        self
    }

    pub fn ticks(&self, count: f64) -> Vec<f64> {
        ticks(self.domain[0], self.domain[1], count)
    }

    /// The default tick format: `,f` with the precision the tick step needs.
    pub fn tick_format(&self, count: f64) -> crate::format::Format {
        let step = tick_step(self.domain[0], self.domain[1], count).abs();
        let precision = if step > 0.0 {
            (-step.log10().floor()).max(0.0) as usize
        } else {
            0
        };
        crate::format::Format::new(&format!(",.{precision}f"))
    }
}

/// `d3.scaleUtc()`: a linear scale over milliseconds with calendar ticks.
#[derive(Clone, Debug)]
pub struct Time {
    pub linear: Linear,
}

impl Time {
    pub fn new(domain: [f64; 2], range: [f64; 2]) -> Self {
        Self {
            linear: Linear::new(domain, range),
        }
    }

    pub fn map(&self, ms: f64) -> f64 {
        self.linear.map(ms)
    }

    pub fn invert(&self, px: f64) -> f64 {
        self.linear.invert(px)
    }

    pub fn ticks(&self, count: f64) -> Vec<f64> {
        time::ticks(self.linear.domain[0], self.linear.domain[1], count)
    }

    /// `scale.nice()`: widen the domain to the tick interval for ten ticks.
    #[must_use]
    pub fn nice(mut self) -> Self {
        let [a, b] = self.linear.domain;
        let t = time::ticks(a, b, 10.0);
        if t.len() >= 2 {
            let step = t[1] - t[0];
            self.linear.domain = [(a / step).floor() * step, (b / step).ceil() * step];
        }
        self
    }
}

/// `d3.scaleBand()`.
#[derive(Clone, Debug)]
pub struct Band {
    pub domain: Vec<String>,
    pub range: [f64; 2],
    pub step: f64,
    pub bandwidth: f64,
    start: f64,
}

impl Band {
    /// `scaleBand().domain(domain).range(range).paddingInner(inner).paddingOuter(outer)`, align 0.5.
    pub fn new(domain: Vec<String>, range: [f64; 2], inner: f64, outer: f64) -> Self {
        let n = domain.len() as f64;
        let (start, stop) = if range[1] < range[0] {
            (range[1], range[0])
        } else {
            (range[0], range[1])
        };
        let step = (stop - start) / (n - inner + outer * 2.0).max(1.0);
        let start = start + (stop - start - step * (n - inner)) * 0.5;
        Self {
            domain,
            range,
            step,
            bandwidth: step * (1.0 - inner),
            start,
        }
    }

    /// `.padding(p)`: the same inner and outer padding.
    pub fn padded(domain: Vec<String>, range: [f64; 2], padding: f64) -> Self {
        Self::new(domain, range, padding, padding)
    }

    pub fn map(&self, key: &str) -> Option<f64> {
        self.domain
            .iter()
            .position(|d| d == key)
            .map(|i| self.start + self.step * i as f64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ticks_match_d3() {
        assert_eq!(ticks(0.0, 10.0, 5.0), [0.0, 2.0, 4.0, 6.0, 8.0, 10.0]);
        assert_eq!(ticks(0.0, 1.0, 5.0), [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]);
        assert_eq!(
            ticks(0.0, 503.0, 5.0),
            [0.0, 100.0, 200.0, 300.0, 400.0, 500.0]
        );
    }

    #[test]
    fn nice_extends_to_round_values() {
        assert_eq!(
            Linear::new([0.0, 503.0], [0.0, 1.0]).nice(10.0).domain,
            [0.0, 550.0]
        );
        assert_eq!(
            Linear::new([0.2, 9.7], [0.0, 1.0]).nice(10.0).domain,
            [0.0, 10.0]
        );
    }

    #[test]
    fn band_positions() {
        let b = Band::new(vec!["a".into(), "b".into()], [0.0, 100.0], 0.2, 0.1);
        assert!((b.step - 100.0 / 2.0).abs() < 1e-9);
        assert!((b.bandwidth - 40.0).abs() < 1e-9);
        // d3.scaleBand().domain(["a","b"]).range([0,100]).paddingInner(0.2).paddingOuter(0.1)("a") === 5
        assert!((b.map("a").unwrap() - 5.0).abs() < 1e-9);
    }
}
