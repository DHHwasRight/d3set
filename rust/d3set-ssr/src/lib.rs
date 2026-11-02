//! Server-side rendering for d3set charts.
//!
//! A chart renders to the same markup the TypeScript library builds in the browser: the same
//! classes, the same d3-axis structure, the same scales, ticks, colors, and number formats. A page
//! is complete without JavaScript. With it, `d3set.hydrate()` reads the embedded JSON payload
//! and replaces each chart with a live one, in the same task, so nothing flashes.

pub mod agg;
pub mod axis;
pub mod chart;
pub mod charts;
pub mod color;
pub mod dashboard;
pub mod format;
pub mod path;
pub mod payload;
pub mod scale;
pub mod sources;
pub mod spec;
pub mod theme;
pub mod time;
pub mod value;

/// The rsx templates. `load_dir!` makes one module per `.rsx` file.
pub mod views {
    rsx::load_dir!("src/views");
}

pub use chart::{render, Error, Rendered};
pub use dashboard::{figure, static_figure, Classes, Dashboard, Filter, Stream};
pub use spec::{Agg, Column, Level, Spec, Threshold};
pub use theme::{Colors, Theme, DARK, DARK_COLORS, LIGHT};
pub use value::{Row, Value};
