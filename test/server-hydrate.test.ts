// @vitest-environment jsdom
// What the JavaScript server renders, the browser hydrates: the same marks, live after.
import { describe, expect, it } from "vitest";
import { hydrate } from "../src/index";
import { renderChart, renderDashboard } from "../src/server";

const rows = [
  { region: "EU", amount: 10 },
  { region: "US", amount: 25 },
  { region: "APAC", amount: 7 },
];

describe("server render, then hydrate", () => {
  it("hydrates a chart into the same marks", () => {
    document.body.innerHTML = renderChart({ spec: { type: "bar", x: "region", y: "amount" }, rows, width: 400 });
    const before = document.querySelectorAll("svg rect").length;
    const handle = hydrate(document);
    expect(handle.charts).toHaveLength(1);
    expect(document.querySelector("[data-d3s-chart]")).toBeNull();
    expect(document.querySelectorAll("svg rect").length).toBe(before);
    handle.destroy();
  });

  it("hydrates a dashboard", () => {
    document.body.innerHTML = renderDashboard({
      charts: [{ type: "bar", x: "region", y: "amount" }, { type: "table" }],
      rows,
    });
    const handle = hydrate(document);
    expect(handle.dashboards).toHaveLength(1);
    expect(document.querySelectorAll(".d3s-card")).toHaveLength(2);
    expect(document.querySelectorAll("tbody tr")).toHaveLength(3);
    handle.destroy();
  });
});
