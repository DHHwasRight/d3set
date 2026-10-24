import * as d3 from "d3";
import type { Row } from "../data/types";
import type { Theme } from "../theme/theme";
import type { Aggregate } from "./types";

export const margin = { top: 8, right: 12, bottom: 24, left: 44 };

/** An SVG that follows the width of its container. */
export function createFrame(el: HTMLElement, height: number, onResize: () => void) {
  el.classList.add("d3s-chart");
  el.style.height = `${height}px`;
  const svg = d3.select(el).append("svg").attr("height", height);
  const size = { width: el.clientWidth || 400, height };
  let ro: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? size.width);
      if (w > 0 && w !== size.width) {
        size.width = w;
        svg.attr("width", w);
        onResize();
      }
    });
    ro.observe(el);
  }
  svg.attr("width", size.width);
  return {
    svg,
    size,
    inner: () => ({
      w: Math.max(0, size.width - margin.left - margin.right),
      h: Math.max(0, size.height - margin.top - margin.bottom),
    }),
    destroy() {
      ro?.disconnect();
      svg.remove();
    },
  };
}

/** Transition length. 0 when the user asks for reduced motion. */
export function motionMs(theme: Theme): number {
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduce ? 0 : theme.motion;
}

export function seriesColor(theme: Theme, keys: string[]) {
  return d3.scaleOrdinal<string, string>().domain(keys).range(theme.color.series);
}

export function aggregate(values: number[], how: Aggregate): number {
  switch (how) {
    case "sum":
      return d3.sum(values);
    case "count":
      return values.length;
    case "avg":
      return d3.mean(values) ?? 0;
    case "min":
      return d3.min(values) ?? 0;
    case "max":
      return d3.max(values) ?? 0;
    case "last":
      return values[values.length - 1] ?? 0;
  }
}

/** Parse a cell as a Date when it looks like a date, else return undefined. */
export function asDate(v: unknown): Date | undefined {
  if (v instanceof Date) return v;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v);
  return undefined;
}

/** A legend placed after the chart element. Hidden when there is one series or fewer. */
export function createLegend(el: HTMLElement) {
  const legend = document.createElement("div");
  legend.className = "d3s-legend";
  el.after(legend);
  return {
    update(keys: string[], color: (k: string) => string) {
      legend.hidden = keys.length <= 1;
      legend.replaceChildren(
        ...keys.map((k) => {
          const item = document.createElement("span");
          const sw = document.createElement("i");
          sw.style.background = color(k);
          item.append(sw, k);
          return item;
        }),
      );
    },
    destroy: () => legend.remove(),
  };
}

export function groupRows(rows: Row[], keyFn: (r: Row) => string) {
  return d3.group(rows, keyFn);
}
