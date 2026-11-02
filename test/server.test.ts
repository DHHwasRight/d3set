// @vitest-environment node
// Server rendering in Node: the markup and payload `hydrate()` reads, with no DOM left behind.
import { describe, expect, it } from "vitest";
import "../src/index";
import { renderChart, renderDashboard, scriptSafe } from "../src/server";

const rows = [
  { region: "EU", amount: 10, at: "2026-01-01T00:00:00Z" },
  { region: "US", amount: 25, at: "2026-01-01T00:01:00Z" },
  { region: "EU", amount: 5, at: "2026-01-01T00:02:00Z" },
];

describe("server rendering", () => {
  it("renders a chart with its payload, scaled to its container", () => {
    const html = renderChart({ spec: { type: "bar", x: "region", y: "amount" }, rows, width: 500, stream: "/events" });
    expect(html).toMatch(/^<figure [^>]*class="d3s-figure"/);
    expect(html).toMatch(/^<figure [^>]*data-d3s-chart=""/);
    expect(html).toContain('viewBox="0 0 500 240"');
    expect(html).toContain('width="100%"');
    expect(html.match(/<rect /g)?.length).toBeGreaterThanOrEqual(2);
    const payload = JSON.parse(html.match(/<script[^>]*class="d3s-payload"[^>]*>(.*?)<\/script>/)![1]!);
    expect(payload.spec.type).toBe("bar");
    expect(payload.rows).toHaveLength(3);
    expect(payload.stream).toBe("/events");
  });

  it("renders a dashboard with filters and cards sized for its width", () => {
    const html = renderDashboard({
      charts: [
        { type: "kpi", title: "Revenue", y: "amount" },
        { type: "bar", title: "By region", x: "region", y: "amount", span: 2 },
      ],
      filters: [{ type: "select", id: "region", field: "region", label: "Region", param: "region", multiple: false }],
      rows,
      width: 960,
    });
    expect(html).toMatch(/data-d3s-dashboard=""/);
    expect(html.match(/class="d3s-card"/g)).toHaveLength(2);
    expect(html).toContain('class="d3s-filter"');
    // A 960px grid has two 472px columns (16px gap); a card spanning both, less its 16px padding.
    expect(html).toContain('data-d3s-width="928"');
  });

  it("leaves no DOM globals behind", () => {
    renderChart({ spec: { type: "kpi", y: "amount" }, rows });
    expect("document" in globalThis).toBe(false);
    expect("window" in globalThis).toBe(false);
  });

  it("keeps a payload from closing its script", () => {
    expect(scriptSafe('{"a":"</script>"}')).toBe('{"a":"\\u003c/script>"}');
  });
});

describe("sseResponse", () => {
  it("streams each message as one event that sseSource parses", async () => {
    const { sseResponse } = await import("../src/server");
    async function* messages() {
      yield [{ a: 1 }];
      yield { op: "replace" as const, rows: [{ a: 2 }] };
    }
    const response = sseResponse(messages(), { heartbeatMs: 60_000 });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const text = await response.text();
    const events = text
      .split("\n\n")
      .filter(Boolean)
      .map((e) => JSON.parse(e.replace(/^data: /, "")));
    expect(events).toEqual([[{ a: 1 }], { op: "replace", rows: [{ a: 2 }] }]);
  });
});

describe("server rendering of HTML charts", () => {
  it("renders a table in a server-side DOM", () => {
    const html = renderChart({ spec: { type: "table" }, rows });
    expect(html).toContain("<thead>");
    expect(html.match(/<tr>/g)?.length).toBe(4);
  });
  it("adds the classes option to the controls and cards, and carries it in the payload", () => {
    const classes = { button: "btn x", input: "in", select: "sel", card: "card" };
    const html = renderDashboard({
      charts: [{ type: "kpi", title: "Revenue", y: "amount" }],
      filters: [{ type: "select", id: "region", field: "region", label: "Region", param: "region", multiple: false }],
      rows,
      width: 960,
      classes,
    });
    expect(html).toContain('class="d3s-filter-reset btn x"');
    expect(html).toContain('<select class="sel"');
    expect(html).toMatch(/<section class="d3s-card card"/);
    expect(html).toContain('"classes":{"button":"btn x","input":"in","select":"sel","card":"card"}');
  });
});
