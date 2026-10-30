// @vitest-environment jsdom
// Chart types on demand: the core registers none, and `loadChartsFor` registers exactly the
// types the payloads under a root use.
import { describe, expect, it } from "vitest";
import { hasChart } from "../src/charts/registry";
import { payloadTypes } from "../src/hydrate";
import { chartLoaders, loadCharts, loadChartsFor } from "../src/lazy";

function payload(attr: string, json: unknown): string {
  return `<div ${attr}><script type="application/json" class="d3s-payload">${JSON.stringify(json)}</script></div>`;
}

describe("lazy chart types", () => {
  it("reads the chart types of dashboards and single charts", () => {
    document.body.innerHTML =
      payload("data-d3s-dashboard", { charts: [{ type: "funnel" }, { type: "gauge" }], rows: [] }) +
      payload("data-d3s-chart", { spec: { type: "sunburst" }, rows: [] });
    expect(payloadTypes(document).sort()).toEqual(["funnel", "gauge", "sunburst"]);
  });

  it("registers only the types a page uses", async () => {
    // Registered by no other test of this file: the registry is per module instance.
    expect(hasChart("slo")).toBe(false);
    expect(hasChart("hostmap")).toBe(false);
    document.body.innerHTML = payload("data-d3s-chart", { spec: { type: "slo" }, rows: [] });
    await loadChartsFor(document);
    expect(hasChart("slo")).toBe(true);
    expect(hasChart("hostmap")).toBe(false);
  });

  it("leaves a type without a loader to the app", async () => {
    await loadCharts(["custom-type"]);
    expect(hasChart("custom-type")).toBe(false);
  });

  // Last: importing the full chart index registers every type.
  it("has a loader for every built-in type", async () => {
    const { builtInCharts } = await import("../src/charts/index");
    expect(Object.keys(chartLoaders).sort()).toEqual(Object.keys(builtInCharts).sort());
  });
});
