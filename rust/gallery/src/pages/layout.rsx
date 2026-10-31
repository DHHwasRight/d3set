// Layer 1, the shell: top bar, navigation, and the outlet `#app` every page swaps into.

use crate::catalog::{entry, GROUPS};
use crate::libraries::{links, CURRENT};
use crate::pages::TITLE;
use crate::site::{base, is_static, js, swap_ring_attrs};

pub fn Layout(layout: &str, path: &str, children: Element) -> Element {
    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            // The stored theme choice, before the first paint: no flash of the other theme.
            if js() {
                <script>{!crate::site::THEME_SCRIPT}</script>
            }
            <title>{TITLE} · charts rendered on the server</title>
            <link rel="icon" href="/favicon.svg" type="image/svg+xml">
            // A static host cannot read DP-Partial: dp-swap fetches partials/<depth>/<path>.
            if is_static() {
                <meta name="dp-config" content={dp_config()}>
            }
            <link rel="stylesheet" href={crate::assets::url("css/d3set.css")}>
            <link rel="stylesheet" href={crate::assets::url("css/gallery.css")}>
        </head>
        // `dp-boost` makes every link a partial navigation into `#app`.
        <body dp-boost dp-target="#app" { ...swap_ring_attrs() }>
            <header class="top">
                <a class="brand" href="/"><span class="brand-mark"></span>{TITLE}</a>
                <TopNav path={path} oob={false} />
                <div class="top-search"><span>Search the gallery</span><kbd>/</kbd></div>
                <LibrarySwitch path={path} oob={false} />
                if js() {
                    <ThemeSwitch />
                }
            </header>
            <div class="shell">
                <aside class="side">
                    <SideNav path={path} oob={false} />
                </aside>
                // The marker is on the outlet: a swap replaces its children, so the shell stays.
                <main id="app" class="main" dp-layout={layout}>{children}</main>
            </div>
            if js() {
                <script src="/dpswap.min.js"></script>
                <script type="module" src={crate::assets::url("js/gallery.js")}></script>
            }
        </body>
    </html>
}

// ------------------------------------------------------------ out of band
//
// A partial does not contain the shell, so the parts of it that depend on the path go stale.
// `html!` sends this with a partial that keeps only this layer; the client applies each element
// by id. A section layout that is kept sends its own `Oob` instead.

pub fn Oob(path: &str) -> Element {
    <TopNav path={path} oob={true} />
    <LibrarySwitch path={path} oob={true} />
    <SideNav path={path} oob={true} />
}

pub fn TopNav(path: &str, oob: bool) -> Element {
    <nav class="top-nav" id="top-nav" { ...oob_attrs(oob) }>
        <a href="/" class={top_class(path, "/")}>Overview</a>
        <a href="/charts/timeseries" class={top_class(path, "/charts")}>Charts</a>
        <a href="/dashboards/ops" class={top_class(path, "/dashboards")}>Dashboards</a>
        <a href="/guide" class={top_class(path, "/guide")}>Guide</a>
    </nav>
}

// The same page drawn by each binding, each on its own server: not boosted. The links name the
// current path; `_src/library-switch.js` keeps them right when only `#app` changed.
pub fn LibrarySwitch(path: &str, oob: bool) -> Element {
    <nav class="library-switch" id="library-switch" aria-label="Library" data-path={path} { ...oob_attrs(oob) }>
        for (library, href) in links(path) {
            <a href={href} data-library={library.id} dp-boost="false" { ...current_attr(library.id) }>{library.name}</a>
        }
    </nav>
}

// Light or dark. The page follows the system until a click stores a choice; `_src/theme.js`
// handles the click. It does not depend on the path, so a partial never sends it.
pub fn ThemeSwitch() -> Element {
    <button type="button" class="theme-switch" id="theme-switch" aria-label="Dark mode" aria-pressed="false">
        <svg class="moon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1z" fill="currentColor"></path></svg>
        <svg class="sun" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor"></circle><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>
    </button>
}

pub fn SideNav(path: &str, oob: bool) -> Element {
    <nav id="side-nav" { ...oob_attrs(oob) }>
        <div class="side-group">
            <div class="side-title">Get started</div>
            <a href="/" class={side_class(path, "/")}>Overview</a>
            <a href="/guide" class={side_class(path, "/guide")}>Getting started</a>
        </div>
        <div class="side-group">
            <div class="side-title">Dashboards</div>
            <a href="/dashboards/ops" class={side_class(path, "/dashboards/ops")}>Observability</a>
            <a href="/dashboards/sales" class={side_class(path, "/dashboards/sales")}>Business</a>
        </div>
        for group in GROUPS {
            <div class="side-group">
                <div class="side-title">{group.name}</div>
                for kind in group.kinds.iter() {
                    <a href={chart_href(kind)} class={side_class(path, &chart_href(kind))}>{chart_name(kind)}</a>
                }
            </div>
        }
        <div class="side-group">
            <div class="side-title">Analytics</div>
            <a href="/analytics" class={prefix_class(path, "/analytics")}>Billing</a>
        </div>
    </nav>
}

/// dp-swap's settings on a static site: the partial trees, under the site's base path.
fn dp_config() -> String {
    format!(r#"{{"partialDir":"partials","base":"{}"}}"#, base())
}

fn prefix_class(path: &str, prefix: &str) -> &'static str {
    if path == prefix || path.starts_with(&format!("{prefix}/")) { "side-link is-current" } else { "side-link" }
}

fn oob_attrs(oob: bool) -> Option<(&'static str, &'static str)> {
    oob.then_some(("dp-swap-oob", "outerHTML"))
}

fn current_attr(id: &str) -> Option<(&'static str, &'static str)> {
    (id == CURRENT).then_some(("aria-current", "page"))
}

fn chart_href(kind: &str) -> String {
    format!("/charts/{kind}")
}

fn chart_name(kind: &str) -> &'static str {
    entry(kind).map_or("", |e| e.name)
}

fn top_class(path: &str, prefix: &str) -> &'static str {
    let on = if prefix == "/" { path == "/" } else { path.starts_with(prefix) };
    if on { "is-current" } else { "" }
}

fn side_class(path: &str, href: &str) -> &'static str {
    if path == href { "side-link is-current" } else { "side-link" }
}
