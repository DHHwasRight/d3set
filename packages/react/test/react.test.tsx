// @vitest-environment jsdom
// The React bindings: client components drawn in the browser, and server components rendered to
// HTML, then hydrated.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Chart, Dashboard } from "../src/index";
import { ServerChart, ServerDashboard } from "../src/server";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const rows = [
  { region: "EU", amount: 10 },
  { region: "US", amount: 25 },
  { region: "APAC", amount: 7 },
];

function mount(node: React.ReactNode) {
  const el = document.createElement("div");
  document.body.replaceChildren(el);
  const root = createRoot(el);
  act(() => root.render(node));
  return { el, root };
}

describe("client components", () => {
  it("draws a chart, then redraws it in place with new rows", async () => {
    const spec = { type: "bar", x: "region", y: "amount" } as const;
    const { el, root } = mount(<Chart spec={spec} rows={rows} />);
    await vi.waitFor(() => expect(el.querySelectorAll("svg rect").length).toBe(3));
    const svg = el.querySelector("svg");
    act(() => root.render(<Chart spec={spec} rows={rows.slice(0, 2)} />));
    await vi.waitFor(() => expect(el.querySelectorAll("svg rect").length).toBe(2));
    expect(el.querySelector("svg")).toBe(svg);
    act(() => root.unmount());
    expect(el.querySelector("svg")).toBeNull();
  });

  it("draws a dashboard", async () => {
    const { el, root } = mount(
      <Dashboard charts={[{ type: "kpi", title: "Revenue", y: "amount" }, { type: "table" }]} rows={rows} />,
    );
    await vi.waitFor(() => expect(el.querySelectorAll(".d3s-card")).toHaveLength(2));
    expect(el.querySelectorAll("tbody tr")).toHaveLength(3);
    act(() => root.unmount());
  });
});

describe("server components", () => {
  it("renders to HTML on the server, then hydrates into live charts", async () => {
    const node = <ServerChart spec={{ type: "bar", x: "region", y: "amount" }} rows={rows} width={400} />;
    const html = renderToString(node);
    expect(html).toContain("data-d3s-chart");
    expect(html).toContain('class="d3s-payload"');

    const el = document.createElement("div");
    el.innerHTML = html;
    document.body.replaceChildren(el);
    const { hydrateRoot } = await import("react-dom/client");
    act(() => {
      hydrateRoot(el, node);
    });
    // The payload element is consumed: the charts are live.
    await vi.waitFor(() => expect(el.querySelector("[data-d3s-chart]")).toBeNull());
    expect(el.querySelectorAll("svg rect").length).toBe(3);
  });

  it("renders static markup with no payload when not hydrated", () => {
    const html = renderToString(
      <ServerDashboard charts={[{ type: "bar", x: "region", y: "amount" }]} rows={rows} hydrate={false} />,
    );
    expect(html).toContain("d3s-card");
    expect(html).not.toContain("d3s-payload");
    expect(html).not.toContain("data-d3s-dashboard");
  });
});

describe("component options", () => {
  it("survives StrictMode's double mount, renders as a figure, and reports when drawn", async () => {
    const { StrictMode } = await import("react");
    const ready = vi.fn();
    const { el, root } = mount(
      <StrictMode>
        <Chart
          as="figure"
          className="d3s-figure"
          spec={{ type: "table" }}
          rows={rows}
          animate={false}
          onReady={ready}
        />
      </StrictMode>,
    );
    await vi.waitFor(() => expect(ready).toHaveBeenCalled());
    const figure = el.querySelector("figure.d3s-figure");
    expect(figure?.parentElement).toBe(el);
    expect(figure?.querySelectorAll("tbody tr")).toHaveLength(3);
    // The rows source is the mount's own: still open after StrictMode's first cleanup.
    act(() => root.render(<Chart as="figure" spec={{ type: "table" }} rows={rows.slice(0, 1)} />));
    act(() => root.unmount());
  });
});
