// The `short` number format and `options.axisFormat`: compact value axes, exact tooltips.
import { describe, expect, it } from "vitest";
import { axisFormatter, formatter } from "../src/charts/util";

describe("short format", () => {
  const f = formatter("short");
  it("keeps small numbers, with up to 2 decimals", () => {
    expect([0, 5, 12.5, 585, 999.4].map(f)).toEqual(["0", "5", "12.5", "585", "999.4"]);
  });
  it("shortens with k, M, B, T and 3 significant digits", () => {
    expect([1000, 1500, 369_500, 1_234_567, 4_500_000_000, 2e12].map(f)).toEqual(["1k", "1.5k", "370k", "1.23M", "4.5B", "2T"]);
  });
  it("takes the next unit when rounding reaches 1,000", () => {
    expect([999.996, 999_999, 999_600_000].map(f)).toEqual(["1k", "1M", "1B"]);
  });
  it("writes negatives with d3's minus sign", () => {
    expect([-369_500, -585].map(f)).toEqual(["−370k", "−585"]);
  });
});

describe("axisFormatter", () => {
  it("uses options.axisFormat, else the chart's format, else the fallback", () => {
    expect(axisFormatter({ type: "bar", format: ",.2f", options: { axisFormat: "short" } }, ".3~s")(369_500)).toBe("370k");
    expect(axisFormatter({ type: "bar", format: ",.2f" }, ".3~s")(369_500)).toBe("369,500.00");
    expect(axisFormatter({ type: "bar" }, ".3~s")(369_500)).toBe("370k");
  });
});
