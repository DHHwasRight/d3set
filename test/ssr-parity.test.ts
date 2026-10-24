/**
 * Server/browser parity: the Rust renderer (rust/d3set-ssr) must draw what the TypeScript library draws.
 * Each case renders in jsdom with the TS chart and through the Rust `render` example, then compares
 * axis labels, legend, mark geometry, and text. Skipped when the Rust example is not built:
 *   mise exec -- cargo build -p d3set-ssr --example render
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getChart, lightTheme, type ChartSpec, type Row } from "../src/index";
import { sampleRows } from "./parity/sample";
import type { Cases } from "./parity/types";

const BIN = "target/debug/examples/render";
const WIDTH = 400; // jsdom has no layout: the TS frame falls back to 400px.

// Every `test/parity/*.cases.ts` file adds cases. One file per chart group, so ports do not collide.
const modules = import.meta.glob<{ cases: Cases }>("./parity/*.cases.ts", { eager: true });
const cases: Cases = Object.assign({}, ...Object.values(modules).map((m) => m.cases));

const NUM = /-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/g;

/** Deep equality where numbers inside strings may differ by 0.01 (float order of operations). */
function expectClose(actual: unknown, expected: unknown, path = "chart"): void {
  if (typeof actual === "string" && typeof expected === "string") {
    const shape = (s: string) => s.replace(NUM, "#");
    expect(shape(actual), path).toBe(shape(expected));
    const a = actual.match(NUM) ?? [];
    const b = expected.match(NUM) ?? [];
    a.forEach((n, i) => {
      if (Math.abs(Number(n) - Number(b[i])) > 0.01) expect(actual, path).toBe(expected);
    });
    return;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    expect(actual.length, `${path}.length`).toBe(expected.length);
    actual.forEach((v, i) => expectClose(v, expected[i], `${path}[${i}]`));
    return;
  }
  if (actual && expected && typeof actual === "object" && typeof expected === "object") {
    for (const k of Object.keys(expected)) expectClose((actual as never)[k], (expected as never)[k], `${path}.${k}`);
    return;
  }
  expect(actual, path).toEqual(expected);
}

/** The parts of a rendered chart both sides must agree on. */
function normalize(root: Element) {
  const texts = (sel: string) => [...root.querySelectorAll(sel)].map((t) => t.textContent ?? "");
  // Every SVG element except axes, grid lines, and pointer layers (brush, hover rule), which the server does not draw.
  const skip = ".d3s-axis-x, .d3s-axis-y, .d3s-gridlines, .d3s-brush, .d3s-rule";
  const marks = [...root.querySelectorAll("svg *")]
    .filter((e) => !e.closest(skip) && !e.matches(skip))
    .filter((e) => !["g", "title", "clippath"].includes(e.tagName.toLowerCase()))
    .map((e) => {
      const keep = [
        "x",
        "y",
        "width",
        "height",
        "d",
        "fill",
        "stroke",
        "cx",
        "cy",
        "r",
        "x1",
        "x2",
        "y1",
        "y2",
        "opacity",
        "fill-opacity",
      ];
      const attrs = keep
        .filter((a) => e.hasAttribute(a))
        .map((a) => `${a}=${e.getAttribute(a)}`)
        .join(" ");
      const text = e.tagName.toLowerCase() === "text" ? ` "${e.textContent}"` : "";
      return `${e.tagName.toLowerCase()} ${attrs}${text}`;
    });
  const chart = root.querySelector(".d3s-chart");
  // HTML views (table, top list, status, ...): the text, and the class of every element, in order.
  const svgless = chart && !chart.querySelector("svg");
  const html = svgless ? (chart.textContent ?? "").replace(/\s+/g, " ").trim() : "";
  const classes = svgless
    ? [...chart.querySelectorAll("*")]
        .filter((e) => !e.matches(".d3s-tooltip"))
        .map((e) => `${e.tagName.toLowerCase()}.${e.getAttribute("class") ?? ""}`)
    : [];
  return {
    x: texts(".d3s-axis-x .tick text"),
    y: texts(".d3s-axis-y .tick text"),
    legend: [...root.querySelectorAll(".d3s-legend-item")].map(
      (b) => `${b.textContent}|${(b.querySelector("i") as HTMLElement).style.background}`,
    ),
    legendHidden: (root.querySelector(".d3s-legend") as HTMLElement | null)?.hidden ?? null,
    marks,
    html,
    classes,
    chartClass: chart?.getAttribute("class") ?? "",
    height: (chart as HTMLElement | null)?.style.height ?? "",
  };
}

function browser(spec: ChartSpec, rows: Row[], width: number) {
  const parent = document.createElement("div");
  const el = document.createElement("div");
  // jsdom has no layout: give the chart element the width the server assumes.
  Object.defineProperty(el, "clientWidth", { value: width });
  parent.append(el);
  const chart = getChart(spec.type)(el, spec, { theme: { ...lightTheme, motion: 0 } });
  chart.update(rows);
  return normalize(parent);
}

function server(results: Array<{ html?: string; error?: string }>, i: number) {
  const r = results[i]!;
  if (r.error) throw new Error(r.error);
  const parent = document.createElement("div");
  parent.innerHTML = r.html!;
  return normalize(parent);
}

const run = existsSync(BIN) ? describe : describe.skip;

run("server render matches browser render", () => {
  const names = Object.keys(cases);
  const input = names.map((n) => ({
    spec: cases[n]!.spec,
    rows: cases[n]!.rows ?? sampleRows,
    width: cases[n]!.width ?? WIDTH,
  }));
  const results = JSON.parse(execFileSync(BIN, { input: JSON.stringify(input) }).toString());

  names.forEach((name, i) => {
    it(name, () => {
      const c = cases[name]!;
      expectClose(server(results, i), browser(c.spec, c.rows ?? sampleRows, c.width ?? WIDTH));
    });
  });
});
