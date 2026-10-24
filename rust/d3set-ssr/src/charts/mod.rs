//! One module per chart type, each a port of the TypeScript chart's first render.
//! See `rust/d3set-ssr/PORTING.md`.

use crate::chart::{Ctx, Error, Rendered};

pub mod area;
pub mod bar;
pub mod boxplot;
pub mod change;
pub mod funnel;
pub mod gauge;
pub mod heatmap;
pub mod histogram;
pub mod hostmap;
pub mod kpi;
pub mod line;
pub mod note;
pub mod pie;
pub mod scatter;
pub mod slo;
pub mod status;
pub mod stream;
pub mod sunburst;
pub mod table;
pub mod timeheatmap;
pub mod timeseries;
pub mod toplist;
pub mod treemap;
pub mod xy;

pub fn render(c: &Ctx) -> Result<Rendered, Error> {
    match c.spec.kind.as_str() {
        "bar" => bar::render(c),
        "donut" => pie::donut(c),
        "line" => line::render(c),
        "area" => area::render(c),
        "timeseries" => timeseries::render(c),
        "pie" => pie::render(c),
        "sunburst" => sunburst::render(c),
        "gauge" => gauge::render(c),
        "heatmap" => heatmap::render(c),
        "timeheatmap" => timeheatmap::render(c),
        "histogram" => histogram::render(c),
        "scatter" => scatter::render(c),
        "boxplot" => boxplot::render(c),
        "treemap" => treemap::render(c),
        "funnel" => funnel::render(c),
        "kpi" => kpi::render(c),
        "slo" => slo::render(c),
        "note" => note::render(c),
        "table" => table::render(c),
        "toplist" => toplist::render(c),
        "change" => change::render(c),
        "hostmap" => hostmap::render(c),
        "status" => status::render(c),
        "stream" => stream::render(c),
        other => Err(Error(format!("d3set: unknown chart type '{other}'."))),
    }
}
