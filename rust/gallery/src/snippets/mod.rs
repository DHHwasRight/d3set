//! The code the docs show. Each snippet is a file of its own that the gallery runs, so a page
//! shows it whole, and it cannot drift from what draws the charts.

pub mod chart;

/// A source file of the gallery, by the path a reader finds it at, and its grammar.
pub struct Snippet {
    pub path: &'static str,
    pub lang: &'static str,
    pub code: &'static str,
}

macro_rules! snippet {
    ($path:literal, $lang:literal, $file:literal) => {
        Snippet { path: $path, lang: $lang, code: include_str!($file) }
    };
}

pub const CHART: Snippet = snippet!("rust/gallery/src/snippets/chart.rs", "rust", "chart.rs");
pub const HYDRATE: Snippet = snippet!("rust/gallery/assets/js/_src/hydrate.js", "js", "../../assets/js/_src/hydrate.js");
pub const FEEDS: Snippet = snippet!("rust/gallery/src/feeds.jt", "jt", "../feeds.jt");

/// What the summary of a code block calls a grammar.
pub fn lang_name(lang: &str) -> &'static str {
    match lang {
        "rust" => "Rust",
        "rsx" => "rsx",
        "jt" => "jt",
        "js" => "JavaScript",
        "ts" => "TypeScript",
        "json" => "JSON",
        _ => "Text",
    }
}
