use crate::pages::guide::Code;

pub fn Guide(spec: &str, chart: &Code, template: &Code, hydrate: &Code, stream: &str, feeds: &Code) -> Element {
    <article class="page">
        <div class="eyebrow">Get started</div>
        <h1>Getting started</h1>
        <p class="lead">A chart is a spec, rows, and a theme. Every d3set gallery draws the same specs; only the code around them changes. The code on this page is the code this gallery runs, read from its source files.</p>

        <h2>The spec</h2>
        <p>A spec names the chart type and the fields it reads. It is plain JSON, the same in Rust, TypeScript, and React. Each chart page shows the spec of every example.</p>
        <div class="block">{!spec}</div>

        <div data-snippet="guide">
            <h2>1. Render on the server</h2>
            <p><code>d3set-ssr</code> ports the scales, ticks, number formats, colors, and markup of every d3set chart. A spec and rows go in; SVG or HTML comes out, with the same classes the browser library uses, so one stylesheet styles both.</p>
            <Source code={chart}></Source>
            <p>The markup is an rsx template: Rust with a markup body, compiled into the binary. This one draws the bar chart.</p>
            <Source code={template}></Source>

            <h2>2. Hydrate in the browser</h2>
            <Source code={hydrate}></Source>
            <p><code>hydrate</code> reads each embedded payload, builds the live chart, and replaces the server markup in the same task. A dashboard gets its filters, cross-filtering, brush zoom, and time window back. An element without a payload stays static: open any page with <code>?js=off</code> to see what the server sends.</p>

            <h2>3. Follow the data</h2>
            <p>With a <code>Stream</code>, the page subscribes to server-sent events. Each frame is an envelope or bare rows:</p>
            <div class="block">{!stream}</div>

            <h2>Sample data with jt</h2>
            <p>The feeds are typed Rust structs. jt compiles their JSON templates, so the data endpoints, the stream frames, and the payloads are written without a serializer at runtime.</p>
            <Source code={feeds}></Source>
            <p>Try <a href="/data/ops?limit=5" dp-boost="false">/data/ops?limit=5</a> and <a href="/data/sales?limit=5" dp-boost="false">/data/sales?limit=5</a>.</p>
        </div>

        <h2>Parity</h2>
        <p>Each chart type has parity cases: the TypeScript chart renders in jsdom, the Rust port renders the same spec, and the test compares axis labels, legends, mark geometry, and text. The galleries in plain TypeScript, React, and Next.js draw every page of the Rust gallery, and Playwright checks that each one draws it the same way.</p>
    </article>
}

/// A source file: its path and grammar as the summary, the code open below.
fn Source(code: &Code) -> Element {
    <details class="code" open>
        <summary>{code.path} <span class="lang">{code.lang}</span></summary>
        {!code.html}
    </details>
}
