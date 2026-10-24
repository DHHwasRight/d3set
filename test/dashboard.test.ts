import { describe, expect, it } from "vitest";
import { createDashboard, select, staticSource } from "../src/index";

describe("createDashboard", () => {
  it("renders charts and filters rows on the client", () => {
    const el = document.createElement("div");
    const src = staticSource([
      { region: "EU", amount: 10 },
      { region: "US", amount: 30 },
    ]);
    const dash = createDashboard(el, {
      source: src,
      filters: [select("region")],
      charts: [
        { type: "kpi", title: "Total", y: "amount" },
        { type: "bar", title: "By region", x: "region", y: "amount" },
      ],
    });
    const kpi = () => el.querySelector(".d3s-kpi")!.textContent;
    expect(kpi()).toBe("40");
    expect(el.querySelectorAll("select option")).toHaveLength(3); // All, EU, US

    dash.filters.set("region", "US");
    expect(kpi()).toBe("30");

    src.set([...src.rows(), { region: "US", amount: 5 }]);
    expect(kpi()).toBe("35");
    dash.destroy();
    expect(el.children).toHaveLength(0);
  });
});
