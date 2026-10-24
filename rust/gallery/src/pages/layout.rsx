// The shell: top bar, navigation, and the content column. Documentation-style layout.

use crate::catalog::{entry, GROUPS};
use crate::pages::TITLE;

pub fn Layout(layout: &str, path: &str, children: Element) -> Element {
    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>{TITLE} · charts rendered on the server</title>
            <link rel="icon" href="/favicon.svg" type="image/svg+xml">
            <link rel="stylesheet" href={crate::assets::url("css/d3set.css")}>
            <link rel="stylesheet" href={crate::assets::url("css/gallery.css")}>
        </head>
        <body data-layout={layout}>
            <header class="top">
                <a class="brand" href="/"><span class="brand-mark"></span>{TITLE}</a>
                <nav class="top-nav">
                    <a href="/" class={top_class(path, "/")}>Overview</a>
                    <a href="/charts/timeseries" class={top_class(path, "/charts")}>Charts</a>
                    <a href="/dashboards/ops" class={top_class(path, "/dashboards")}>Dashboards</a>
                    <a href="/guide" class={top_class(path, "/guide")}>Guide</a>
                </nav>
                <div class="top-search"><span>Search the gallery</span><kbd>/</kbd></div>
            </header>
            <div class="shell">
                <aside class="side">
                    <nav>
                        <div class="side-group">
                            <div class="side-title">Get started</div>
                            <a href="/" class={side_class(path, "/")}>Overview</a>
                            <a href="/guide" class={side_class(path, "/guide")}>Server rendering</a>
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
                    </nav>
                </aside>
                <main class="main">{children}</main>
            </div>
        </body>
    </html>
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
