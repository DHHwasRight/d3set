use crate::pages::guide::{HYDRATE, JT, RENDER, STREAM};

pub fn Guide() -> Element {
    <article class="page">
        <div class="eyebrow">Get started</div>
        <h1>Server rendering and hydration</h1>
        <p class="lead">One chart spec, three ways to use it: as static markup from Rust, as an interactive chart after hydration, and as a live chart that follows a stream.</p>

        <h2>1. Render on the server</h2>
        <p><code>d3set-ssr</code> ports the scales, ticks, number formats, colors, and markup of every d3set chart. A spec and rows go in; SVG or HTML comes out, with the same classes the browser library uses, so one stylesheet styles both.</p>
        <pre class="block"><code>{RENDER}</code></pre>
        <p>Rendering is a pure function of the spec, the rows, the theme, and the width. The server cannot measure the page, so the caller passes the chart width; the SVG scales to the real card until the browser redraws it.</p>

        <h2>2. Hydrate in the browser</h2>
        <pre class="block"><code>{HYDRATE}</code></pre>
        <p><code>hydrate</code> reads each embedded payload, builds the live chart, and replaces the server markup in the same task, with no transition on the first draw. Nothing flashes and nothing moves. A dashboard gets its filters, cross-filtering, brush zoom, and time window back.</p>
        <p>An element without a payload stays static. Open any page with <code>?js=off</code> to see what the server sends.</p>

        <h2>3. Follow the data</h2>
        <p>With a <code>Stream</code>, the page subscribes to server-sent events. The URL carries <code>since</code>, the time of the newest embedded row, so the first frame sends only what the page does not have. Rows upsert by <code>id</code>: a reconnect that replays rows does not count them twice.</p>
        <pre class="block"><code>{STREAM}</code></pre>

        <h2>Sample data with jt</h2>
        <p>The feeds are typed Rust structs. jt compiles their JSON templates, so the data endpoints, the stream frames, and the payloads are written without a serializer at runtime.</p>
        <pre class="block"><code>{JT}</code></pre>
        <p>Try <a href="/data/ops?limit=5">/data/ops?limit=5</a> and <a href="/data/sales?limit=5">/data/sales?limit=5</a>.</p>

        <h2>Parity</h2>
        <p>Each chart type has parity cases: the TypeScript chart renders in jsdom, the Rust port renders the same spec, and the test compares axis labels, legends, mark geometry, and text. Hydration swaps like for like because the two renders agree.</p>
    </article>
}
