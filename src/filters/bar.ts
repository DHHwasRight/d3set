import { distinctValues, type FilterDef, type FilterStore } from "./filters";
import type { Row } from "../data/types";

/**
 * Render a filter bar in `el`. Select options with no fixed list come from
 * `rows()` and refresh when you call `refresh()`.
 */
export function renderFilterBar(
  el: HTMLElement,
  defs: FilterDef[],
  store: FilterStore,
  rows: () => Row[] = () => [],
): { refresh(): void; destroy(): void } {
  el.classList.add("d3s-filters");
  const refreshers: Array<() => void> = [];
  // Put the store value back into each control when something else (a chart click, code) changes it.
  const syncers: Array<() => void> = [];

  for (const def of defs) {
    const wrap = document.createElement("label");
    wrap.className = "d3s-filter";
    wrap.dataset.filter = def.id;
    const title = document.createElement("span");
    title.textContent = def.label;
    wrap.append(title);

    switch (def.type) {
      case "select": {
        const sel = document.createElement("select");
        sel.multiple = def.multiple;
        sel.addEventListener("change", () => {
          const picked = [...sel.selectedOptions].map((o) => o.value).filter((v) => v !== "");
          store.set(def.id, def.multiple ? picked : picked[0]);
        });
        let signature = "";
        const fill = () => {
          const current = store.get()[def.id];
          const chosen = new Set(Array.isArray(current) ? current : current ? [String(current)] : []);
          const opts = def.options ?? distinctValues(rows(), def.field);
          // Keep chosen values visible even when the data no longer has them.
          const all = [...new Set([...opts, ...chosen])];
          // Rebuild only when the options change, so an open dropdown keeps its state during live updates.
          const next = JSON.stringify([all, [...chosen]]);
          if (next === signature) return;
          signature = next;
          sel.replaceChildren(
            ...(def.multiple ? [] : [new Option("All", "")]),
            ...all.map((o) => new Option(o, o, false, chosen.has(o))),
          );
        };
        fill();
        refreshers.push(fill);
        syncers.push(fill);
        wrap.append(sel);
        break;
      }
      case "search": {
        const input = document.createElement("input");
        input.type = "search";
        input.placeholder = "Search…";
        input.addEventListener("input", () => store.set(def.id, input.value || undefined));
        syncers.push(() => {
          const v = store.get()[def.id];
          const text = typeof v === "string" ? v : "";
          if (input.value !== text) input.value = text;
        });
        wrap.append(input);
        break;
      }
      case "range":
      case "dateRange": {
        const isDate = def.type === "dateRange";
        const [a, b] = [document.createElement("input"), document.createElement("input")];
        for (const [input, ph] of [
          [a, isDate ? "From" : "Min"],
          [b, isDate ? "To" : "Max"],
        ] as const) {
          input.type = isDate ? "date" : "number";
          input.placeholder = ph;
          input.setAttribute("aria-label", `${def.label} ${ph.toLowerCase()}`);
          if (def.type === "range") {
            if (def.min !== undefined) input.min = String(def.min);
            if (def.max !== undefined) input.max = String(def.max);
            if (def.step !== undefined) input.step = String(def.step);
          }
          input.style.width = isDate ? "auto" : "6em";
        }
        const update = () => {
          if (isDate) store.set(def.id, { from: a.value || undefined, to: b.value || undefined });
          else
            store.set(def.id, {
              min: a.value === "" ? undefined : Number(a.value),
              max: b.value === "" ? undefined : Number(b.value),
            });
        };
        a.addEventListener("input", update);
        b.addEventListener("input", update);
        syncers.push(() => {
          const v = (store.get()[def.id] ?? {}) as Record<string, string | number | undefined>;
          const [lo, hi] = isDate ? [v.from, v.to] : [v.min, v.max];
          // Date inputs take YYYY-MM-DD; a brush range has full timestamps.
          const show = (x: string | number | undefined) =>
            x === undefined ? "" : isDate ? String(x).slice(0, 10) : String(x);
          if (document.activeElement !== a) a.value = show(lo);
          if (document.activeElement !== b) b.value = show(hi);
        });
        const pair = document.createElement("div");
        pair.style.display = "flex";
        pair.style.gap = "4px";
        pair.append(a, b);
        wrap.append(pair);
        break;
      }
    }
    el.append(wrap);
  }

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "d3s-filter-reset";
  reset.textContent = "Reset";
  reset.addEventListener("click", () => store.reset((id) => !defs.some((d) => d.id === id)));
  el.append(reset);
  const off = store.subscribe(() => syncers.forEach((f) => f()));

  return {
    refresh: () => refreshers.forEach((f) => f()),
    destroy: () => {
      off();
      el.replaceChildren();
    },
  };
}
