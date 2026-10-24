import { describe, expect, it } from "vitest";
import { mergeRows } from "../src/data/merge";

describe("mergeRows", () => {
  it("appends and keeps the last maxRows", () => {
    const out = mergeRows([{ v: 1 }, { v: 2 }], [{ v: 3 }], { mode: "append", maxRows: 2 });
    expect(out).toEqual([{ v: 2 }, { v: 3 }]);
  });

  it("replaces", () => {
    expect(mergeRows([{ v: 1 }], [{ v: 9 }], { mode: "replace" })).toEqual([{ v: 9 }]);
  });

  it("upserts by key", () => {
    const out = mergeRows(
      [
        { id: "a", v: 1 },
        { id: "b", v: 2 },
      ],
      [
        { id: "b", v: 5 },
        { id: "c", v: 7 },
      ],
      {
        mode: "upsert",
        key: "id",
      },
    );
    expect(out).toEqual([
      { id: "a", v: 1 },
      { id: "b", v: 5 },
      { id: "c", v: 7 },
    ]);
  });

  it("uses the envelope op from the server", () => {
    const out = mergeRows([{ v: 1 }], { op: "replace", rows: { v: 2 } }, { mode: "append" });
    expect(out).toEqual([{ v: 2 }]);
  });

  it("fails on upsert without key", () => {
    expect(() => mergeRows([], [], { mode: "upsert" })).toThrow(/requires option 'key'/);
  });
});
