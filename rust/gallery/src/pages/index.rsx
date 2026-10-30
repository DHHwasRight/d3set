use crate::pages::index::Section;
use crate::site::{inline_code, is_static};

pub fn Overview(sections: &[Section]) -> Element {
    <article class="page">
        <div class="eyebrow">d3set gallery</div>
        <div data-snippet="intro">
            <h1>Charts rendered on the server, live in the browser</h1>
            <p class="lead">
                Every chart on these pages is drawn in Rust with rsx: the same scales, ticks, colors, and markup as the d3 library in the browser. The page is complete before any JavaScript runs. Then the browser takes over each chart in place and follows the data {follows()}.
            </p>
            <div class="modes">
                <div class="mode">
                    <div class="mode-tag">1 · Server</div>
                    <h3>Static SVG and HTML</h3>
                    if is_static() {
                        <p>rsx renders the first frame when the site is built. No script needed: each page is complete HTML.</p>
                    } else {
                        <p>rsx renders the first frame. No script needed: open any page with <code>?js=off</code>.</p>
                    }
                </div>
                <div class="mode">
                    <div class="mode-tag">2 · Hydrate</div>
                    <h3>Interactive, same data</h3>
                    <p>The page embeds the spec and rows as JSON. <code>hydrate()</code> swaps in live charts without a flash.</p>
                </div>
                <div class="mode">
                    <div class="mode-tag">3 · Live</div>
                    if is_static() {
                        <h3>Updates from a timeline</h3>
                        <p>The page polls a recorded feed, a JSON file next to the pages. Sample rows are typed in Rust and written by jt.</p>
                    } else {
                        <h3>Updates over SSE</h3>
                        <p>A stream sends only the rows newer than the page. Sample rows are typed in Rust and written by jt.</p>
                    }
                </div>
            </div>
        </div>
        for section in sections {
            <h2 class="section-title">{section.name}</h2>
            <div class="thumbs">
                for t in &section.thumbs {
                    <a class="thumb" href={href(t.kind)}>
                        <div class="thumb-chart">{!t.html}</div>
                        <div class="thumb-text">
                            <strong>{t.name}</strong>
                            <span>{!inline_code(t.summary)}</span>
                        </div>
                    </a>
                }
            </div>
        }
    </article>
}

fn href(kind: &str) -> String {
    format!("/charts/{kind}")
}

fn follows() -> &'static str {
    if is_static() { "from a recorded feed" } else { "over server-sent events" }
}
