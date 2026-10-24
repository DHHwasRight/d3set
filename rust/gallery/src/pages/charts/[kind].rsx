use crate::catalog::Entry;
use crate::pages::charts::_kind_::Neighbor;
use crate::site::{boot_script, inline_code, ExampleView};

pub fn ChartPage(entry: &Entry, examples: &[ExampleView], js: bool, path: &str, prev: Option<&Neighbor>, next: Option<&Neighbor>) -> Element {
    <article class="page">
        <div class="eyebrow">Charts · <code>{entry.kind}</code></div>
        <h1>{entry.name}</h1>
        <p class="lead">{!inline_code(entry.summary)}</p>
        <div class="callout">
            if js {
                <span class="badge badge-live">Live</span>
                Rendered on the server, then hydrated and fed over SSE.
                <a href={off_href(path)}>View without JavaScript</a>
            } else {
                <span class="badge">Static</span>
                What the server sends: SVG and HTML, no script.
                <a href={path}>Turn JavaScript back on</a>
            }
        </div>
        for ex in examples {
            <section class="example">
                <h2>{ex.title}</h2>
                <p class="muted">{!inline_code(ex.note)} <span class="feed">feed: <code>{ex.feed}</code></span></p>
                <div class="figure">{!ex.html}</div>
                <details class="code">
                    <summary>Spec</summary>
                    <pre><code>{ex.spec_json}</code></pre>
                </details>
            </section>
        }
        <nav class="pager">
            if prev.is_some() {
                <a class="pager-prev" href={prev_href(prev)}><span>Previous</span>{prev_name(prev)}</a>
            } else {
                <span></span>
            }
            if next.is_some() {
                <a class="pager-next" href={prev_href(next)}><span>Next</span>{prev_name(next)}</a>
            }
        </nav>
        if js {
            <script type="module">{!boot_script()}</script>
        }
    </article>
}

fn off_href(path: &str) -> String {
    format!("{path}?js=off")
}

fn prev_href(n: Option<&Neighbor>) -> &str {
    n.map_or("", |n| n.href.as_str())
}

fn prev_name(n: Option<&Neighbor>) -> &str {
    n.map_or("", |n| n.name)
}
