//! d3-axis markup: the same groups, classes, and attributes `d3.axisBottom` and `d3.axisLeft` write.

use crate::format::{js_number, Format};
use crate::scale::{Band, Linear, Time};

/// The pixel offset d3-axis adds on displays with `devicePixelRatio > 1`, which is 0.
const OFFSET: f64 = 0.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Orient {
    Bottom,
    Left,
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
    /// The domain line. Grid lines have none.
    pub domain: Option<String>,
}

impl Axis {
    pub fn anchor(&self) -> &'static str {
        if self.orient == Orient::Left {
            "end"
        } else {
            "middle"
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
        if self.orient == Orient::Left {
            "0.32em"
        } else {
            "0.71em"
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
    let ticks = tick_marks(scale, count, format)
        .into_iter()
        .map(|(pos, label)| Tick {
            transform: match orient {
                Orient::Bottom => format!("translate({},0)", js_number(pos)),
                Orient::Left => format!("translate(0,{})", js_number(pos)),
            },
            label,
        })
        .collect();
    let [r0, r1] = scale.range();
    let domain = with_domain.then(|| match orient {
        Orient::Bottom => format!(
            "M{},0V{}H{}V0",
            js_number(r0 + OFFSET),
            js_number(OFFSET),
            js_number(r1 + OFFSET)
        ),
        Orient::Left => format!(
            "M0,{}H{}V{}H0",
            js_number(r0 + OFFSET),
            js_number(OFFSET),
            js_number(r1 + OFFSET)
        ),
    });
    Axis {
        class,
        orient,
        transform: None,
        ticks,
        size,
        domain,
    }
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
    let label = |v: f64| fmt.format(v);
    let label: &dyn Fn(f64) -> String = &label;
    let (x_count, x_fmt) = if value_on_x {
        ((w / 80.0).max(2.0), Some(label))
    } else {
        ((w / 90.0).max(2.0), None)
    };
    let mut xa = axis("d3s-axis-x", Orient::Bottom, &x, x_count, x_fmt, 6.0, true);
    xa.transform = Some(format!("translate(0,{})", js_number(h)));
    let ya = axis(
        "d3s-axis-y",
        Orient::Left,
        &y,
        5.0,
        (!value_on_x).then_some(label),
        6.0,
        true,
    );
    let empty = |_: f64| String::new();
    let empty: &dyn Fn(f64) -> String = &empty;
    let grid = if value_on_x {
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
    XYAxes { grid, x: xa, y: ya }
}
