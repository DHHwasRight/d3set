import { describe, expect, it } from "vitest";
import { applyFilters, dateRange, filtersToParams, multiSelect, range, search, select } from "../src/filters/filters";

const rows = [
  { region: "EU", amount: 10, customer: "Acme", at: "2026-01-01T10:00:00Z" },
  { region: "US", amount: 50, customer: "Globex", at: "2026-01-02T10:00:00Z" },
  { region: "APAC", amount: 90, customer: "Initech", at: "2026-01-03T10:00:00Z" },
];

describe("filters", () => {
  it("passes all rows when no filter is active", () => {
    expect(applyFilters(rows, [select("region")], {})).toHaveLength(3);
  });

  it("combines filters with AND", () => {
    const defs = [multiSelect("region"), range("amount")];
    const out = applyFilters(rows, defs, { region: ["EU", "US"], amount: { min: 20 } });
    expect(out.map((r) => r.customer)).toEqual(["Globex"]);
  });

  it("searches case-insensitively", () => {
    expect(applyFilters(rows, [search("customer")], { customer: "glob" })).toHaveLength(1);
  });

  it("includes the whole 'to' day in a date range", () => {
    const out = applyFilters(rows, [dateRange("at")], { at: { from: "2026-01-02", to: "2026-01-02" } });
    expect(out.map((r) => r.customer)).toEqual(["Globex"]);
  });

  it("encodes filters as query parameters", () => {
    const defs = [select("region", { param: "r" }), range("amount"), dateRange("at")];
    expect(filtersToParams(defs, { region: "EU", amount: { max: 5 }, at: { from: "2026-01-01" } })).toEqual({
      r: "EU",
      amount_max: "5",
      at_from: "2026-01-01",
    });
  });
});
