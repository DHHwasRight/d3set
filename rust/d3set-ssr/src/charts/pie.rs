//! `pie` and `donut`: share of a total by category. Port of `charts/pie.ts`.
//!
//! This module also holds `arc`, a port of `d3.arc()` with `cornerRadius` that the sunburst and
//! gauge ports use too. The shared `path::arc` has no corner radius, and `path::Path` uses
//! d3-shape's epsilon (1e-12) where d3-path uses 1e-6, which adds `L` commands to rounded arcs.

use std::f64::consts::{FRAC_PI_2, PI, TAU};

use crate::agg::{by_name, rollup, top_n};
use crate::chart::{Ctx, Error, LegendItem, Rendered};
use crate::color::SeriesColors;
use crate::path::n;
use crate::spec::Agg;
use crate::views;

/// One slice, ready for the template.
pub struct Slice {
    pub d: String,
    pub fill: &'static str,
}

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    draw(c, c.spec.inner_radius.unwrap_or(0.0))
}

/// `donut`: a pie with `innerRadius: 0.6` unless the spec sets one.
pub fn donut(c: &Ctx) -> Result<Rendered, Error> {
    draw(c, c.spec.inner_radius.unwrap_or(0.6))
}

fn draw(c: &Ctx, inner_radius: f64) -> Result<Rendered, Error> {
    let x_field = c.need("x")?;
    let y_field = c.need("y")?;
    let how = c.aggregate(Agg::Sum);
    let height = c.height(240);
    let margin = 4.0;
    let w = (c.width - 2.0 * margin).max(0.0);
    let h = (height - 2.0 * margin).max(0.0);
    let r = (w.min(h) / 2.0).max(0.0);

    // Name order keeps slices in place while live data slides; `limit` orders by size.
    let all = rollup(c.rows, |row| row.text(x_field), y_field, how);
    let entries = match c.spec.limit.filter(|&l| l > 0) {
        Some(limit) => top_n(all, Some(limit)),
        None => {
            let mut all = all;
            all.sort_by(|a, b| by_name(&a.0, &b.0));
            all
        }
    };
    let keys: Vec<String> = entries.iter().map(|e| e.0.clone()).collect();
    let colors = SeriesColors::new(c.theme, &keys);

    // d3.pie().sort(null).value(e => Math.max(0, e[1])), no pad angle on the pie itself.
    let values: Vec<f64> = entries.iter().map(|e| js_max0(e.1)).collect();
    let sum: f64 = values.iter().filter(|&&v| v > 0.0).sum();
    let k = if sum != 0.0 { TAU / sum } else { 0.0 };
    let inner = r * inner_radius.clamp(0.0, 0.9);
    let corner = c.theme.radius.min(2.0);
    let mut a0 = 0.0;
    let slices = entries
        .iter()
        .zip(&values)
        .map(|((key, _), &v)| {
            let a1 = a0 + if v > 0.0 { v * k } else { 0.0 };
            let s = Slice {
                d: arc(inner, r, a0, a1, 0.01, corner),
                fill: colors.get(key),
            };
            a0 = a1;
            s
        })
        .collect::<Vec<_>>();

    let body = rsx::Template::render_to_string(views::pie::Pie {
        width: c.width,
        height,
        transform: views::frame::translate(margin + w / 2.0, margin + h / 2.0),
        slices: &slices,
    })?;
    Ok(Rendered {
        body,
        height,
        legend: keys
            .iter()
            .map(|k| LegendItem {
                key: k.clone(),
                color: colors.get(k).to_string(),
            })
            .collect(),
        force_legend: true,
        has_legend: true,
        ..Default::default()
    })
}

/// JavaScript `Math.max(0, v)`: NaN stays NaN.
fn js_max0(v: f64) -> f64 {
    if v.is_nan() {
        v
    } else {
        v.max(0.0)
    }
}

const EPSILON: f64 = 1e-12;
const PATH_EPSILON: f64 = 1e-6;

/// A d3-path `Path` with `digits(3)`, with d3-path's epsilon.
#[derive(Default)]
struct P {
    d: String,
    cur: Option<(f64, f64)>,
    start: (f64, f64),
}

impl P {
    fn move_to(&mut self, x: f64, y: f64) {
        self.d.push_str(&format!("M{},{}", n(x), n(y)));
        self.cur = Some((x, y));
        self.start = (x, y);
    }

    fn line_to(&mut self, x: f64, y: f64) {
        self.d.push_str(&format!("L{},{}", n(x), n(y)));
        self.cur = Some((x, y));
    }

    fn close(&mut self) {
        if self.cur.is_some() {
            self.cur = Some(self.start);
            self.d.push('Z');
        }
    }

    fn arc(&mut self, x: f64, y: f64, r: f64, a0: f64, a1: f64, ccw: bool) {
        let (dx, dy) = (r * a0.cos(), r * a0.sin());
        let (x0, y0) = (x + dx, y + dy);
        let cw = u8::from(!ccw);
        let mut da = if ccw { a0 - a1 } else { a1 - a0 };
        match self.cur {
            None => {
                self.d.push_str(&format!("M{},{}", n(x0), n(y0)));
            }
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
}

#[allow(clippy::too_many_arguments)]
fn intersect(
    x0: f64,
    y0: f64,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    x3: f64,
    y3: f64,
) -> Option<(f64, f64)> {
    let (x10, y10, x32, y32) = (x1 - x0, y1 - y0, x3 - x2, y3 - y2);
    let t = y32 * x10 - x32 * y10;
    if t * t < EPSILON {
        return None;
    }
    let t = (x32 * (y0 - y2) - y32 * (x0 - x2)) / t;
    Some((x0 + t * x10, y0 + t * y10))
}

struct Tangent {
    cx: f64,
    cy: f64,
    x01: f64,
    y01: f64,
    x11: f64,
    y11: f64,
}

fn corner_tangents(x0: f64, y0: f64, x1: f64, y1: f64, r1: f64, rc: f64, cw: bool) -> Tangent {
    let x01 = x0 - x1;
    let y01 = y0 - y1;
    let lo = (if cw { rc } else { -rc }) / (x01 * x01 + y01 * y01).sqrt();
    let ox = lo * y01;
    let oy = -lo * x01;
    let x11 = x0 + ox;
    let y11 = y0 + oy;
    let x10 = x1 + ox;
    let y10 = y1 + oy;
    let x00 = (x11 + x10) / 2.0;
    let y00 = (y11 + y10) / 2.0;
    let dx = x10 - x11;
    let dy = y10 - y11;
    let d2 = dx * dx + dy * dy;
    let r = r1 - rc;
    let big_d = x11 * y10 - x10 * y11;
    let d = (if dy < 0.0 { -1.0 } else { 1.0 }) * (r * r * d2 - big_d * big_d).max(0.0).sqrt();
    let mut cx0 = (big_d * dy - dx * d) / d2;
    let mut cy0 = (-big_d * dx - dy * d) / d2;
    let cx1 = (big_d * dy + dx * d) / d2;
    let cy1 = (-big_d * dx + dy * d) / d2;
    let (dx0, dy0, dx1, dy1) = (cx0 - x00, cy0 - y00, cx1 - x00, cy1 - y00);
    if dx0 * dx0 + dy0 * dy0 > dx1 * dx1 + dy1 * dy1 {
        cx0 = cx1;
        cy0 = cy1;
    }
    Tangent {
        cx: cx0,
        cy: cy0,
        x01: -ox,
        y01: -oy,
        x11: cx0 * (r1 / r - 1.0),
        y11: cy0 * (r1 / r - 1.0),
    }
}

/// `d3.arc()` with `padAngle` and `cornerRadius`, as d3-shape 3 draws it (`digits(3)`).
/// Angles in radians, clockwise from 12 o'clock. The negated comparisons keep d3's NaN behavior.
#[allow(clippy::neg_cmp_op_on_partial_ord)]
pub(crate) fn arc(
    inner: f64,
    outer: f64,
    start: f64,
    end: f64,
    pad_angle: f64,
    corner_radius: f64,
) -> String {
    let mut ctx = P::default();
    let (mut r0, mut r1) = (inner, outer);
    let a0 = start - FRAC_PI_2;
    let a1 = end - FRAC_PI_2;
    let da = (a1 - a0).abs();
    let cw = a1 > a0;
    if r1 < r0 {
        std::mem::swap(&mut r0, &mut r1);
    }
    if !(r1 > EPSILON) {
        ctx.move_to(0.0, 0.0);
    } else if da > TAU - EPSILON {
        ctx.move_to(r1 * a0.cos(), r1 * a0.sin());
        ctx.arc(0.0, 0.0, r1, a0, a1, !cw);
        if r0 > EPSILON {
            ctx.move_to(r0 * a1.cos(), r0 * a1.sin());
            ctx.arc(0.0, 0.0, r0, a1, a0, cw);
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
        let rc = ((r1 - r0).abs() / 2.0).min(corner_radius);
        let (mut rc0, mut rc1) = (rc, rc);

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

        let (x01, y01) = (r1 * a01.cos(), r1 * a01.sin());
        let (x10, y10) = (r0 * a10.cos(), r0 * a10.sin());

        if rc > EPSILON {
            let (x11, y11) = (r1 * a11.cos(), r1 * a11.sin());
            let (x00, y00) = (r0 * a00.cos(), r0 * a00.sin());
            if da < PI {
                if let Some(oc) = intersect(x01, y01, x00, y00, x11, y11, x10, y10) {
                    let (ax, ay) = (x01 - oc.0, y01 - oc.1);
                    let (bx, by) = (x11 - oc.0, y11 - oc.1);
                    let kc = 1.0
                        / (((ax * bx + ay * by)
                            / ((ax * ax + ay * ay).sqrt() * (bx * bx + by * by).sqrt()))
                        .acos()
                            / 2.0)
                            .sin();
                    let lc = (oc.0 * oc.0 + oc.1 * oc.1).sqrt();
                    rc0 = rc.min((r0 - lc) / (kc - 1.0));
                    rc1 = rc.min((r1 - lc) / (kc + 1.0));
                } else {
                    rc0 = 0.0;
                    rc1 = 0.0;
                }
            }
        }

        // Outer ring.
        if !(da1 > EPSILON) {
            ctx.move_to(x01, y01);
        } else if rc1 > EPSILON {
            let (x11, y11) = (r1 * a11.cos(), r1 * a11.sin());
            let (x00, y00) = (r0 * a00.cos(), r0 * a00.sin());
            let t0 = corner_tangents(x00, y00, x01, y01, r1, rc1, cw);
            let t1 = corner_tangents(x11, y11, x10, y10, r1, rc1, cw);
            ctx.move_to(t0.cx + t0.x01, t0.cy + t0.y01);
            if rc1 < rc {
                ctx.arc(
                    t0.cx,
                    t0.cy,
                    rc1,
                    t0.y01.atan2(t0.x01),
                    t1.y01.atan2(t1.x01),
                    !cw,
                );
            } else {
                ctx.arc(
                    t0.cx,
                    t0.cy,
                    rc1,
                    t0.y01.atan2(t0.x01),
                    t0.y11.atan2(t0.x11),
                    !cw,
                );
                ctx.arc(
                    0.0,
                    0.0,
                    r1,
                    (t0.cy + t0.y11).atan2(t0.cx + t0.x11),
                    (t1.cy + t1.y11).atan2(t1.cx + t1.x11),
                    !cw,
                );
                ctx.arc(
                    t1.cx,
                    t1.cy,
                    rc1,
                    t1.y11.atan2(t1.x11),
                    t1.y01.atan2(t1.x01),
                    !cw,
                );
            }
        } else {
            ctx.move_to(x01, y01);
            ctx.arc(0.0, 0.0, r1, a01, a11, !cw);
        }

        // Inner ring, or the center point.
        if !(r0 > EPSILON) || !(da0 > EPSILON) {
            ctx.line_to(x10, y10);
        } else if rc0 > EPSILON {
            let (x11, y11) = (r1 * a11.cos(), r1 * a11.sin());
            let (x00, y00) = (r0 * a00.cos(), r0 * a00.sin());
            let t0 = corner_tangents(x10, y10, x11, y11, r0, -rc0, cw);
            let t1 = corner_tangents(x01, y01, x00, y00, r0, -rc0, cw);
            ctx.line_to(t0.cx + t0.x01, t0.cy + t0.y01);
            if rc0 < rc {
                ctx.arc(
                    t0.cx,
                    t0.cy,
                    rc0,
                    t0.y01.atan2(t0.x01),
                    t1.y01.atan2(t1.x01),
                    !cw,
                );
            } else {
                ctx.arc(
                    t0.cx,
                    t0.cy,
                    rc0,
                    t0.y01.atan2(t0.x01),
                    t0.y11.atan2(t0.x11),
                    !cw,
                );
                ctx.arc(
                    0.0,
                    0.0,
                    r0,
                    (t0.cy + t0.y11).atan2(t0.cx + t0.x11),
                    (t1.cy + t1.y11).atan2(t1.cx + t1.x11),
                    cw,
                );
                ctx.arc(
                    t1.cx,
                    t1.cy,
                    rc0,
                    t1.y11.atan2(t1.x11),
                    t1.y01.atan2(t1.x01),
                    !cw,
                );
            }
        } else {
            ctx.arc(0.0, 0.0, r0, a10, a00, cw);
        }
    }
    ctx.close();
    ctx.d
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_arc_like_shared_helper() {
        assert_eq!(
            arc(0.0, 10.0, 0.0, PI / 2.0, 0.0, 0.0),
            "M0,-10A10,10,0,0,1,10,0L0,0Z"
        );
        assert_eq!(
            arc(30.0, 50.0, 0.5, 2.0, 0.01, 0.0),
            "M24.227,-43.739A50,50,0,0,1,45.585,20.542L27.399,12.219A30,30,0,0,0,14.638,-26.186Z"
        );
    }

    #[test]
    fn rounded_arc_like_d3() {
        // d3.arc().innerRadius(0).outerRadius(100).cornerRadius(2)({startAngle: 0, endAngle: Math.PI / 2})
        assert_eq!(
            arc(0.0, 100.0, 0.0, PI / 2.0, 0.0, 2.0),
            "M0,-97.98A2,2,0,0,1,2.041,-99.979A100,100,0,0,1,99.979,-2.041A2,2,0,0,1,97.98,0L0,0Z"
        );
        // d3.arc().innerRadius(60).outerRadius(100).padAngle(0.01).cornerRadius(2)({startAngle: 0.3, endAngle: 2})
        assert_eq!(
            arc(60.0, 100.0, 0.3, 2.0, 0.01, 2.0),
            "M29.508,-93.418A2,2,0,0,1,32.06,-94.722A100,100,0,0,1,91.995,39.203A2,2,0,0,1,89.323,40.238\
             L56.57,25.248A2,2,0,0,1,55.551,22.674A60,60,0,0,0,20.104,-56.532A2,2,0,0,1,18.863,-59.007Z"
        );
    }
}
