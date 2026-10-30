//! d3-axis markup: the same groups, classes, and attributes `d3.axisBottom`, `d3.axisLeft`, and
//! `d3.axisRight` write.

use crate::format::{js_number, Format};
use crate::scale::{Band, Linear, Time};

/// The pixel offset d3-axis adds: 0 on displays with `devicePixelRatio > 1`, 0.5 otherwise (crisp
/// 1px lines). The server cannot know the display; it draws for high-density screens.
const OFFSET: f64 = 0.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Orient {
    Bottom,
    Left,
    Right,
}

/// A scale an axis can read.
pub enum Scale<'a> {
    Linear(&'a Linear),
    Time(&'a Time),
    Band(&'a Band),
}

impl Scale<'_> {
    fn range(&self) -> [f64; 2] {
        match self {
            Scale::Linear(s) => s.range,
            Scale::Time(s) => s.linear.range,
            Scale::Band(b) => b.range,
        }
    }
}

pub struct Tick {
    pub transform: String,
    pub label: String,
    /// `text-anchor` of the label itself, set by `ticks: "edges"` on the bottom axis.
    pub anchor: Option<&'static str>,
}

/// One axis group, ready for the `Axis` template.
pub struct Axis {
    pub class: &'static str,
    pub orient: Orient,
    /// `transform` of the group, for the x axis at the bottom of the plot.
    pub transform: Option<String>,
    pub ticks: Vec<Tick>,
    /// Inner tick size: 6 for an axis, the plot size for grid lines.
    pub size: f64,
    /// An empty group with only its class, as an axis layer that d3 never draws into (`axes: "none"`).
    pub bare: bool,
    /// The domain line. Grid lines have none.
    pub domain: Option<String>,
}

impl Axis {
    /// An empty layer: no ticks, no domain, no attributes but the class.
    pub fn bare(class: &'static str) -> Self {
        Axis {
            class,
            orient: Orient::Bottom,
            transform: None,
            ticks: Vec::new(),
            size: 0.0,
            bare: true,
            domain: None,
        }
    }

    pub fn anchor(&self) -> &'static str {
        match self.orient {
            Orient::Left => "end",
            Orient::Right => "start",
            Orient::Bottom => "middle",
        }
    }

    /// `x2` or `y2` of the tick line.
    pub fn line_end(&self) -> String {
        js_number(if self.orient == Orient::Left {
            -self.size
        } else {
            self.size
        })
    }

    /// Text offset from the tick: tick size (when positive) plus padding 3, outward.
    pub fn text_offset(&self) -> String {
        let spacing = self.size.max(0.0) + 3.0;
        js_number(if self.orient == Orient::Left {
            -spacing
        } else {
            spacing
        })
    }

    pub fn dy(&self) -> &'static str {
        if self.orient == Orient::Bottom {
            "0.71em"
        } else {
            "0.32em"
        }
    }
}

/// Tick values and labels for a scale. `format` overrides the scale's default labels.
fn tick_marks(
    scale: &Scale<'_>,
    count: f64,
    format: Option<&dyn Fn(f64) -> String>,
) -> Vec<(f64, String)> {
    match scale {
        Scale::Linear(s) => {
            let default = s.tick_format(count);
            s.ticks(count)
                .into_iter()
                .map(|v| {
                    (
                        s.map(v) + OFFSET,
                        format.map_or_else(|| default.format(v), |f| f(v)),
                    )
                })
                .collect()
        }
        Scale::Time(s) => s
            .ticks(count)
            .into_iter()
            .map(|v| {
                (
                    s.map(v) + OFFSET,
                    format.map_or_else(|| crate::time::multi_format(v), |f| f(v)),
                )
            })
            .collect(),
        Scale::Band(b) => b
            .domain
            .iter()
            .map(|d| {
                (
                    b.map(d).unwrap_or(0.0) + b.bandwidth / 2.0 + OFFSET,
                    d.clone(),
                )
            })
            .collect(),
    }
}

fn to_ticks(orient: Orient, marks: Vec<(f64, String)>) -> Vec<Tick> {
    marks
        .into_iter()
        .map(|(pos, label)| Tick {
            transform: match orient {
                Orient::Bottom => format!("translate({},0)", js_number(pos)),
                Orient::Left | Orient::Right => format!("translate(0,{})", js_number(pos)),
            },
            label,
            anchor: None,
        })
        .collect()
}

/// `axis.tickValues(values)`: marks at the given values instead of the scale's ticks. Band scales
/// keep the categories in `values`. A linear scale without `format` labels values as `String(x)`;
/// a time scale uses its multi-scale format.
fn marks_at(
    scale: &Scale<'_>,
    values: &Edges,
    format: Option<&dyn Fn(f64) -> String>,
) -> Vec<(f64, String)> {
    match (scale, values) {
        (Scale::Band(b), Edges::Band(keep)) => keep
            .iter()
            .map(|d| {
                (
                    b.map(d).unwrap_or(0.0) + b.bandwidth / 2.0 + OFFSET,
                    d.clone(),
                )
            })
            .collect(),
        (Scale::Linear(s), Edges::Num(vs)) => vs
            .iter()
            .map(|&v| {
                (
                    s.map(v) + OFFSET,
                    format.map_or_else(|| js_number(v), |f| f(v)),
                )
            })
            .collect(),
        (Scale::Time(s), Edges::Num(vs)) => vs
            .iter()
            .map(|&v| {
                (
                    s.map(v) + OFFSET,
                    format.map_or_else(|| crate::time::multi_format(v), |f| f(v)),
                )
            })
            .collect(),
        _ => Vec::new(),
    }
}

/// Build an axis. `count` is the tick count hint; band scales ignore it.
pub fn axis(
    class: &'static str,
    orient: Orient,
    scale: &Scale<'_>,
    count: f64,
    format: Option<&dyn Fn(f64) -> String>,
    size: f64,
    with_domain: bool,
) -> Axis {
    let ticks = to_ticks(orient, tick_marks(scale, count, format));
    let [r0, r1] = scale.range();
    // d3-axis with `tickSizeOuter(0)`, as d3set uses it, writes the short path: one segment.
    let domain = with_domain.then(|| match orient {
        Orient::Bottom => format!(
            "M{},{}H{}",
            js_number(r0 + OFFSET),
            js_number(OFFSET),
            js_number(r1 + OFFSET)
        ),
        Orient::Left | Orient::Right => format!(
            "M{},{}V{}",
            js_number(OFFSET),
            js_number(r0 + OFFSET),
            js_number(r1 + OFFSET)
        ),
    });
    Axis {
        class,
        orient,
        transform: None,
        ticks,
        size,
        bare: false,
        domain,
    }
}

/// TS `bandLabelEvery`: 1 when the longest category label fits its band, else the smallest n so
/// that every nth label fits. Labels are estimated at 6.5px a character (UTF-16 units, as
/// JavaScript counts them) plus 6px.
pub fn band_label_every(domain: &[String], step: f64) -> usize {
    let longest = domain
        .iter()
        .map(|d| d.encode_utf16().count())
        .max()
        .unwrap_or(0) as f64;
    if step > 0.0 {
        ((longest * 6.5 + 6.0) / step).ceil().max(1.0) as usize
    } else {
        1
    }
}

/// Tick values for `ticks: "edges"`: x values (ms for times) or band categories.
pub enum Edges {
    Num(Vec<f64>),
    Band(Vec<String>),
}

impl Edges {
    /// The first and last of sorted values (one value gives one tick), like TS `edgesOf`.
    pub fn of<T: Clone>(values: &[T]) -> Vec<T> {
        match values {
            [first, .., last] => vec![first.clone(), last.clone()],
            _ => values.to_vec(),
        }
    }
}

/// The look options of `renderAxes`: `edges` (`ticks: "edges"`) and `right` (`valueAxis: "right"`).
#[derive(Default)]
pub struct Look {
    /// The category-axis values to label. The value axis then shows its domain ends, and 0 between them.
    pub edges: Option<Edges>,
    /// The value axis on the right of the plot. No effect when the values are on x.
    pub right: bool,
    /// `axes: "none"`: the three layers are empty.
    pub none: bool,
}

/// The three axis groups of an x/y chart, like `renderAxes` in the TypeScript library:
/// the value axis gets `fmt` labels and grid lines; the other axis gets its scale's labels.
pub struct XYAxes {
    pub grid: Axis,
    pub x: Axis,
    pub y: Axis,
}

pub fn xy_axes(
    x: Scale<'_>,
    y: Scale<'_>,
    w: f64,
    h: f64,
    fmt: &Format,
    value_on_x: bool,
) -> XYAxes {
    xy_axes_with(x, y, w, h, fmt, value_on_x, &Look::default())
}

/// `xy_axes` with the look options.
pub fn xy_axes_with(
    x: Scale<'_>,
    y: Scale<'_>,
    w: f64,
    h: f64,
    fmt: &Format,
    value_on_x: bool,
    look: &Look,
) -> XYAxes {
    if look.none {
        return XYAxes {
            grid: Axis::bare("d3s-gridlines"),
            x: Axis::bare("d3s-axis-x"),
            y: Axis::bare("d3s-axis-y"),
        };
    }
    let right = look.right && !value_on_x;
    let label = |v: f64| fmt.format(v);
    let label: &dyn Fn(f64) -> String = &label;
    let (x_count, x_fmt) = if value_on_x {
        ((w / 80.0).max(2.0), Some(label))
    } else {
        ((w / 90.0).max(2.0), None)
    };
    let mut xa = axis("d3s-axis-x", Orient::Bottom, &x, x_count, x_fmt, 6.0, true);
    if let (false, Scale::Band(b)) = (value_on_x, &x) {
        let every = band_label_every(&b.domain, b.step);
        if every > 1 {
            xa.ticks = std::mem::take(&mut xa.ticks)
                .into_iter()
                .step_by(every)
                .collect();
        }
    }
    xa.transform = Some(format!("translate(0,{})", js_number(h)));
    let mut ya = axis(
        "d3s-axis-y",
        if right { Orient::Right } else { Orient::Left },
        &y,
        5.0,
        (!value_on_x).then_some(label),
        6.0,
        true,
    );
    if right {
        ya.transform = Some(format!("translate({},0)", js_number(w)));
    }
    let empty = |_: f64| String::new();
    let empty: &dyn Fn(f64) -> String = &empty;
    let mut grid = if value_on_x {
        axis(
            "d3s-gridlines",
            Orient::Bottom,
            &x,
            (w / 80.0).max(2.0),
            Some(empty),
            h,
            false,
        )
    } else {
        axis(
            "d3s-gridlines",
            Orient::Left,
            &y,
            5.0,
            Some(empty),
            -w,
            false,
        )
    };
    if let Some(edges) = &look.edges {
        let (value, category) = if value_on_x { (&x, &y) } else { (&y, &x) };
        if let Scale::Linear(v) = value {
            let [lo, hi] = v.domain;
            let ends = Edges::Num(if lo < 0.0 && hi > 0.0 {
                vec![lo, 0.0, hi]
            } else {
                vec![lo, hi]
            });
            let (value_axis, category_axis) = if value_on_x {
                (&mut xa, &mut ya)
            } else {
                (&mut ya, &mut xa)
            };
            value_axis.ticks = to_ticks(value_axis.orient, marks_at(value, &ends, Some(label)));
            category_axis.ticks = to_ticks(category_axis.orient, marks_at(category, edges, None));
            grid.ticks = to_ticks(grid.orient, marks_at(value, &ends, Some(empty)));
        }
        // The bottom axis anchors its first label at its start and its last at its end.
        if let [first, .., last] = &mut xa.ticks[..] {
            first.anchor = Some("start");
            last.anchor = Some("end");
        }
    }
    XYAxes { grid, x: xa, y: ya }
}
