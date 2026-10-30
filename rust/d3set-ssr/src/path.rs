//! SVG path data, as d3-path and d3-shape write it: numbers rounded to 3 decimals (`digits(3)`).

use std::f64::consts::{PI, TAU};

/// d3-shape's epsilon, for arc geometry.
const EPSILON: f64 = 1e-12;
/// d3-path's epsilon, for the path commands themselves (`arc`'s implicit line, full circles).
const PATH_EPSILON: f64 = 1e-6;

/// An attribute number as `selection.attr` writes it: JavaScript's `String(x)`, no rounding.
pub fn raw(x: f64) -> String {
    crate::format::js_number(x + 0.0)
}

/// Format a path coordinate the way d3-shape does by default.
pub fn n(x: f64) -> String {
    crate::format::js_number((x * 1000.0).round() / 1000.0 + 0.0)
}

#[derive(Default)]
pub struct Path {
    d: String,
    /// Current point, for `arc`'s implicit line.
    cur: Option<(f64, f64)>,
}

impl Path {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn move_to(&mut self, x: f64, y: f64) {
        self.d.push_str(&format!("M{},{}", n(x), n(y)));
        self.cur = Some((x, y));
    }

    pub fn line_to(&mut self, x: f64, y: f64) {
        self.d.push_str(&format!("L{},{}", n(x), n(y)));
        self.cur = Some((x, y));
    }

    pub fn bezier_to(&mut self, x1: f64, y1: f64, x2: f64, y2: f64, x: f64, y: f64) {
        self.d.push_str(&format!(
            "C{},{},{},{},{},{}",
            n(x1),
            n(y1),
            n(x2),
            n(y2),
            n(x),
            n(y)
        ));
        self.cur = Some((x, y));
    }

    pub fn close(&mut self) {
        self.d.push('Z');
    }

    /// `context.arc(x, y, r, a0, a1, ccw)` from d3-path.
    pub fn arc(&mut self, x: f64, y: f64, r: f64, a0: f64, a1: f64, ccw: bool) {
        let (dx, dy) = (r * a0.cos(), r * a0.sin());
        let (x0, y0) = (x + dx, y + dy);
        let cw = u8::from(!ccw);
        let mut da = if ccw { a0 - a1 } else { a1 - a0 };
        match self.cur {
            None => self.move_to(x0, y0),
            Some((cx, cy)) if (cx - x0).abs() > PATH_EPSILON || (cy - y0).abs() > PATH_EPSILON => {
                self.line_to(x0, y0)
            }
            _ => {}
        }
        if r == 0.0 {
            return;
        }
        if da < 0.0 {
            da = da % TAU + TAU;
        }
        if da > TAU - PATH_EPSILON {
            self.d.push_str(&format!(
                "A{r},{r},0,1,{cw},{},{}",
                n(x - dx),
                n(y - dy),
                r = n(r)
            ));
            self.d
                .push_str(&format!("A{r},{r},0,1,{cw},{},{}", n(x0), n(y0), r = n(r)));
            self.cur = Some((x0, y0));
        } else if da > PATH_EPSILON {
            let (ex, ey) = (x + r * a1.cos(), y + r * a1.sin());
            self.d.push_str(&format!(
                "A{r},{r},0,{},{cw},{},{}",
                u8::from(da >= PI),
                n(ex),
                n(ey),
                r = n(r)
            ));
            self.cur = Some((ex, ey));
        }
    }

    pub fn finish(self) -> String {
        self.d
    }
}

/// `d3.curveMonotoneX` through `points`. With `continue_line`, the first point is a line from the
/// current point, which is how `d3.area` joins its top line to its baseline.
pub fn monotone_x(path: &mut Path, points: &[(f64, f64)], continue_line: bool) {
    let sign = |x: f64| if x < 0.0 { -1.0 } else { 1.0 };
    let (mut x0, mut y0, mut x1, mut y1, mut t0) =
        (f64::NAN, f64::NAN, f64::NAN, f64::NAN, f64::NAN);
    let mut state = 0;
    let slope3 = |x0: f64, y0: f64, x1: f64, y1: f64, x2: f64, y2: f64| {
        let h0 = x1 - x0;
        let h1 = x2 - x1;
        let s0 = (y1 - y0)
            / if h0 != 0.0 {
                h0
            } else if h1 < 0.0 {
                -0.0
            } else {
                0.0
            };
        let s1 = (y2 - y1)
            / if h1 != 0.0 {
                h1
            } else if h0 < 0.0 {
                -0.0
            } else {
                0.0
            };
        let p = (s0 * h1 + s1 * h0) / (h0 + h1);
        let v = (sign(s0) + sign(s1)) * s0.abs().min(s1.abs()).min(0.5 * p.abs());
        if v.is_nan() {
            0.0
        } else {
            v
        }
    };
    let slope2 = |x0: f64, y0: f64, x1: f64, y1: f64, t: f64| {
        let h = x1 - x0;
        if h != 0.0 {
            (3.0 * (y1 - y0) / h - t) / 2.0
        } else {
            t
        }
    };
    let curve = |path: &mut Path, x0: f64, y0: f64, x1: f64, y1: f64, t0: f64, t1: f64| {
        let dx = (x1 - x0) / 3.0;
        path.bezier_to(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
    };
    for &(x, y) in points {
        let mut t1 = f64::NAN;
        if x == x1 && y == y1 {
            continue;
        }
        match state {
            0 => {
                state = 1;
                if continue_line {
                    path.line_to(x, y)
                } else {
                    path.move_to(x, y)
                }
            }
            1 => state = 2,
            2 => {
                state = 3;
                t1 = slope3(x0, y0, x1, y1, x, y);
                curve(path, x0, y0, x1, y1, slope2(x0, y0, x1, y1, t1), t1);
            }
            _ => {
                t1 = slope3(x0, y0, x1, y1, x, y);
                curve(path, x0, y0, x1, y1, t0, t1);
            }
        }
        x0 = x1;
        x1 = x;
        y0 = y1;
        y1 = y;
        t0 = t1;
    }
    match state {
        2 => path.line_to(x1, y1),
        3 => curve(path, x0, y0, x1, y1, t0, slope2(x0, y0, x1, y1, t0)),
        _ => {}
    }
}

/// `d3.curveLinear` through `points`: straight segments. With `continue_line`, as in `monotone_x`.
pub fn linear(path: &mut Path, points: &[(f64, f64)], continue_line: bool) {
    for (i, &(x, y)) in points.iter().enumerate() {
        if i == 0 && !continue_line {
            path.move_to(x, y);
        } else {
            path.line_to(x, y);
        }
    }
}

/// A d3-shape curve factory.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum Curve {
    #[default]
    MonotoneX,
    Linear,
}

impl Curve {
    fn draw(self, path: &mut Path, points: &[(f64, f64)], continue_line: bool) {
        match self {
            Curve::MonotoneX => monotone_x(path, points, continue_line),
            Curve::Linear => linear(path, points, continue_line),
        }
    }
}

/// `d3.line().curve(d3.curveMonotoneX)`.
pub fn line(points: &[(f64, f64)]) -> String {
    line_with(points, Curve::MonotoneX)
}

/// `d3.line().curve(curve)`. One point is `M x,y Z`, as both curves close a one-point line.
pub fn line_with(points: &[(f64, f64)], curve: Curve) -> String {
    let mut p = Path::new();
    curve.draw(&mut p, points, false);
    if points.len() == 1 {
        p.close();
    }
    p.finish()
}

/// `d3.area().curve(d3.curveMonotoneX)`: points are `(x, y0, y1)`.
pub fn area(points: &[(f64, f64, f64)]) -> String {
    area_with(points, Curve::MonotoneX)
}

/// `d3.area().curve(curve)`: the top line, then the baseline back, closed.
pub fn area_with(points: &[(f64, f64, f64)], curve: Curve) -> String {
    if points.is_empty() {
        return String::new();
    }
    let mut p = Path::new();
    let top: Vec<(f64, f64)> = points.iter().map(|&(x, _, y1)| (x, y1)).collect();
    let base: Vec<(f64, f64)> = points.iter().rev().map(|&(x, y0, _)| (x, y0)).collect();
    curve.draw(&mut p, &top, false);
    curve.draw(&mut p, &base, true);
    p.close();
    p.finish()
}

/// `d3.arc()` without corner radius: angles in radians, clockwise from 12 o'clock.
pub fn arc(inner: f64, outer: f64, start: f64, end: f64, pad_angle: f64) -> String {
    let mut p = Path::new();
    let (mut r0, mut r1) = (inner, outer);
    if r1 < r0 {
        std::mem::swap(&mut r0, &mut r1);
    }
    let a0 = start - PI / 2.0;
    let a1 = end - PI / 2.0;
    let da = (a1 - a0).abs();
    let cw = a1 > a0;
    if r1.is_nan() || r1 <= EPSILON {
        p.move_to(0.0, 0.0);
    } else if da > TAU - EPSILON {
        p.move_to(r1 * a0.cos(), r1 * a0.sin());
        p.arc(0.0, 0.0, r1, a0, a1, !cw);
        if r0 > EPSILON {
            p.move_to(r0 * a1.cos(), r0 * a1.sin());
            p.arc(0.0, 0.0, r0, a1, a0, cw);
        }
    } else {
        let (mut a01, mut a11, mut a00, mut a10) = (a0, a1, a0, a1);
        let (mut da0, mut da1) = (da, da);
        let ap = pad_angle / 2.0;
        let rp = if ap > EPSILON {
            (r0 * r0 + r1 * r1).sqrt()
        } else {
            0.0
        };
        if rp > EPSILON {
            let dir = if cw { 1.0 } else { -1.0 };
            let mut p0 = (rp / r0 * ap.sin()).asin();
            let mut p1 = (rp / r1 * ap.sin()).asin();
            da0 -= p0 * 2.0;
            if da0 > EPSILON {
                p0 *= dir;
                a00 += p0;
                a10 -= p0;
            } else {
                da0 = 0.0;
                a00 = (a0 + a1) / 2.0;
                a10 = a00;
            }
            da1 -= p1 * 2.0;
            if da1 > EPSILON {
                p1 *= dir;
                a01 += p1;
                a11 -= p1;
            } else {
                da1 = 0.0;
                a01 = (a0 + a1) / 2.0;
                a11 = a01;
            }
        }
        p.move_to(r1 * a01.cos(), r1 * a01.sin());
        if da1 > EPSILON {
            p.arc(0.0, 0.0, r1, a01, a11, !cw);
        }
        if r0.is_nan() || r0 <= EPSILON || da0.is_nan() || da0 <= EPSILON {
            p.line_to(r0 * a10.cos(), r0 * a10.sin());
        } else {
            p.arc(0.0, 0.0, r0, a10, a00, cw);
        }
    }
    p.close();
    p.finish()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn monotone_line_like_d3() {
        // d3.line().curve(d3.curveMonotoneX)([[0,0],[10,10],[20,0]])
        assert_eq!(
            line(&[(0.0, 0.0), (10.0, 10.0), (20.0, 0.0)]),
            "M0,0C3.333,5,6.667,10,10,10C13.333,10,16.667,5,20,0"
        );
        assert_eq!(line(&[(0.0, 0.0), (10.0, 10.0)]), "M0,0L10,10");
    }

    #[test]
    fn linear_like_d3() {
        // d3.line()([[0,0],[10,10],[20,0]]) and d3.area()([[0,5,1],[10,5,2]]) as (x, y0, y1)
        let pts = [(0.0, 0.0), (10.0, 10.0), (20.0, 0.0)];
        assert_eq!(line_with(&pts, Curve::Linear), "M0,0L10,10L20,0");
        assert_eq!(line_with(&[(1.0, 2.0)], Curve::Linear), "M1,2Z");
        assert_eq!(
            area_with(&[(0.0, 5.0, 1.0), (10.0, 5.0, 2.0)], Curve::Linear),
            "M0,1L10,2L10,5L0,5Z"
        );
    }

    #[test]
    fn arc_like_d3() {
        // d3.arc().innerRadius(0).outerRadius(10)({startAngle: 0, endAngle: Math.PI / 2})
        assert_eq!(
            arc(0.0, 10.0, 0.0, PI / 2.0, 0.0),
            "M0,-10A10,10,0,0,1,10,0L0,0Z"
        );
        // d3.arc().innerRadius(30).outerRadius(50).padAngle(0.01)({startAngle: 0.5, endAngle: 2})
        assert_eq!(
            arc(30.0, 50.0, 0.5, 2.0, 0.01),
            "M24.227,-43.739A50,50,0,0,1,45.585,20.542L27.399,12.219A30,30,0,0,0,14.638,-26.186Z"
        );
    }
}
