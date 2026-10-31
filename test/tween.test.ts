import { describe, expect, it } from "vitest";
import { tweenStarts } from "../src/charts/util";

const pt = (key: number, x: number, y: number) => ({ key, at: [x, y] });

describe("tweenStarts", () => {
  it("moves a kept point from where it was drawn", () => {
    const before = new Map([[1, [10, 5]]]);
    expect(tweenStarts(before, [pt(1, 8, 6)])).toEqual([[10, 5]]);
  });

  it("grows a new last point from the last kept one, so the line does not fold back", () => {
    const before = new Map([
      [1, [10, 5]],
      [2, [20, 6]],
    ]);
    const starts = tweenStarts(before, [pt(1, 8, 5), pt(2, 18, 6), pt(3, 28, 9)]);
    expect(starts).toEqual([
      [10, 5],
      [20, 6],
      [20, 6],
    ]);
    // Every start x is in order: the path cannot run backwards at any time of the move.
    const xs = starts.map((s) => s[0]!);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it("starts a new first point at the first kept one", () => {
    const before = new Map([[2, [20, 6]]]);
    expect(tweenStarts(before, [pt(1, 10, 1), pt(2, 20, 6)])).toEqual([
      [20, 6],
      [20, 6],
    ]);
  });

  it("starts where it ends when nothing was drawn with these keys", () => {
    expect(tweenStarts(new Map([[9, [1, 1]]]), [pt(1, 10, 1)])).toEqual([[10, 1]]);
  });
});
