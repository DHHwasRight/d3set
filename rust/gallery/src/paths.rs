//! Every path a static export writes. A route with a parameter (`/charts/{kind}`) cannot be
//! enumerated by the router, so the gallery lists its own: the export requests each one through
//! the same handler `serve` uses.

// The static export calls these; until it is wired into this binary, nothing else does.
#![allow(dead_code)]

use crate::analytics::TABS;
use crate::catalog::kinds;

/// The HTML pages: each is written as a document, and as one partial per depth up to
/// [`max_depth`] for dp-swap's `partialDir`.
pub fn pages() -> Vec<String> {
    let mut out = vec!["/".to_string(), "/guide".to_string()];
    out.extend(kinds().map(|k| format!("/charts/{k}")));
    out.extend(["ops", "sales"].map(|d| format!("/dashboards/{d}")));
    out.push("/analytics".to_string());
    out.extend(
        TABS.iter()
            .flat_map(|t| t.views)
            .map(|v| format!("/analytics/{}", v.id)),
    );
    out
}

/// The files that are not pages: written once, under their own name.
pub fn files() -> Vec<String> {
    ["ops", "sales"].map(|f| format!("/data/{f}.json")).to_vec()
}

/// Every path: [`pages`], then [`files`].
pub fn static_paths() -> Vec<String> {
    let mut out = pages();
    out.extend(files());
    out
}

/// The most layout layers a page has: the shell (`pages/layout.rsx`) and a section layout
/// (`charts/`, `dashboards/`, `analytics/`). A partial for depth `n` leaves out the first `n`.
pub fn max_depth() -> u32 {
    2
}

#[cfg(test)]
mod tests {
    use super::*;
    use brocanth::routing::Verb;

    fn get(app: &crate::app::App, path: &str, depth: Option<u32>) -> crate::pages::Response {
        let mut request = brocanth_server::Request::new(Verb::Get, path);
        if let Some(d) = depth {
            request.set_header("dp-partial", &d.to_string());
        }
        crate::app::dispatch(app, &request)
    }

    #[tokio::test]
    async fn every_static_path_answers_200_as_a_document_and_at_each_depth() {
        crate::data::start();
        let app = crate::app::build().unwrap();
        for path in pages() {
            let doc = get(&app, &path, None);
            assert_eq!(doc.status, 200, "{path}");
            assert!(
                doc.body.starts_with("<!DOCTYPE html>"),
                "{path}: not a document"
            );
            for depth in 1..=max_depth() {
                let partial = get(&app, &path, Some(depth));
                assert_eq!(partial.status, 200, "{path} at depth {depth}");
                assert!(
                    !partial.body.contains("<!DOCTYPE"),
                    "{path} at depth {depth}: a document"
                );
            }
        }
        for path in files() {
            assert_eq!(get(&app, &path, None).status, 200, "{path}");
        }
    }

    #[test]
    fn max_depth_is_the_deepest_layout_nesting() {
        // A directory's layouts: its own and its ancestors' under src/pages.
        fn deepest(dir: &std::path::Path, above: u32) -> u32 {
            let here = above + u32::from(dir.join("layout.rsx").exists());
            std::fs::read_dir(dir)
                .unwrap()
                .filter_map(Result::ok)
                .filter(|e| e.path().is_dir())
                .map(|e| deepest(&e.path(), here))
                .fold(here, u32::max)
        }
        let pages = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/pages");
        assert_eq!(deepest(&pages, 0), max_depth());
    }
}
