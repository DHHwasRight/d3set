import type { Row } from "../data/types";

interface BaseFilter {
  /** Unique id. Default: the field name. */
  id: string;
  /** Row field to test. */
  field: string;
  label: string;
  /** Query parameter name when filters go to the server. Default: the id. */
  param: string;
}

export interface SelectFilter extends BaseFilter {
  type: "select";
  /** Fixed options. When absent, options come from the distinct values in the data. */
  options?: string[];
  multiple: boolean;
}

export interface RangeFilter extends BaseFilter {
  type: "range";
  min?: number;
  max?: number;
  step?: number;
}

export interface SearchFilter extends BaseFilter {
  type: "search";
}

export interface DateRangeFilter extends BaseFilter {
  type: "dateRange";
}

export type FilterDef = SelectFilter | RangeFilter | SearchFilter | DateRangeFilter;

/** Value of one filter. `undefined` means "no filter". */
export type FilterValue =
  | string // select, search
  | string[] // multi select
  | { min?: number; max?: number } // range
  | { from?: string; to?: string } // dateRange, ISO dates
  | undefined;

export type FilterState = Record<string, FilterValue>;

type Common = Partial<Pick<BaseFilter, "id" | "label" | "param">>;

const base = (field: string, o: Common = {}) => ({
  id: o.id ?? field,
  field,
  label: o.label ?? field.charAt(0).toUpperCase() + field.slice(1),
  param: o.param ?? o.id ?? field,
});

// Shorthand builders: `filters: [select("region"), range("amount"), search("customer")]`
export const select = (field: string, o: Common & { options?: string[] } = {}): SelectFilter => ({
  ...base(field, o),
  type: "select",
  options: o.options,
  multiple: false,
});
export const multiSelect = (field: string, o: Common & { options?: string[] } = {}): SelectFilter => ({
  ...base(field, o),
  type: "select",
  options: o.options,
  multiple: true,
});
export const range = (field: string, o: Common & { min?: number; max?: number; step?: number } = {}): RangeFilter => ({
  ...base(field, o),
  type: "range",
  min: o.min,
  max: o.max,
  step: o.step,
});
export const search = (field: string, o: Common = {}): SearchFilter => ({ ...base(field, o), type: "search" });
export const dateRange = (field: string, o: Common = {}): DateRangeFilter => ({ ...base(field, o), type: "dateRange" });

function isEmpty(v: FilterValue): boolean {
  if (v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.values(v).every((x) => x === undefined || x === "");
  return false;
}

function matches(def: FilterDef, value: FilterValue, row: Row): boolean {
  const cell = row[def.field];
  switch (def.type) {
    case "select": {
      const wanted = Array.isArray(value) ? value : [value as string];
      return wanted.includes(String(cell));
    }
    case "search":
      return String(cell ?? "")
        .toLowerCase()
        .includes(String(value).toLowerCase());
    case "range": {
      const { min, max } = value as { min?: number; max?: number };
      const n = Number(cell);
      return (min === undefined || n >= min) && (max === undefined || n <= max);
    }
    case "dateRange": {
      const { from, to } = value as { from?: string; to?: string };
      const t = new Date(cell as string | number | Date).getTime();
      // `to` is inclusive of the whole day when it is a plain date.
      const toT = to ? new Date(to).getTime() + (to.length === 10 ? 86_400_000 - 1 : 0) : undefined;
      return (!from || t >= new Date(from).getTime()) && (toT === undefined || t <= toT);
    }
  }
}

/** Keep the rows that pass every active filter. */
export function applyFilters(rows: Row[], defs: FilterDef[], state: FilterState): Row[] {
  const active = defs.filter((d) => !isEmpty(state[d.id]));
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((d) => matches(d, state[d.id], row)));
}

/**
 * Encode the active filters as query parameters, for server-side filtering.
 * range -> `<param>_min`, `<param>_max`; dateRange -> `<param>_from`, `<param>_to`.
 */
export function filtersToParams(defs: FilterDef[], state: FilterState): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const d of defs) {
    const v = state[d.id];
    if (isEmpty(v)) continue;
    if (typeof v === "string" || Array.isArray(v)) out[d.param] = v;
    else if (d.type === "range") {
      const r = v as { min?: number; max?: number };
      if (r.min !== undefined) out[`${d.param}_min`] = String(r.min);
      if (r.max !== undefined) out[`${d.param}_max`] = String(r.max);
    } else if (d.type === "dateRange") {
      const r = v as { from?: string; to?: string };
      if (r.from) out[`${d.param}_from`] = r.from;
      if (r.to) out[`${d.param}_to`] = r.to;
    }
  }
  return out;
}

/** Distinct, sorted values of a field. Used for select options. */
export function distinctValues(rows: Row[], field: string): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r[field] !== undefined && r[field] !== null) set.add(String(r[field]));
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Holds filter state and notifies listeners on change.
 * Each value can record its source: the id of the chart that set it (cross-filter).
 */
export class FilterStore {
  private state: FilterState;
  private sources = new Map<string, string>();
  private listeners = new Set<(s: FilterState) => void>();

  constructor(initial: FilterState = {}) {
    this.state = { ...initial };
  }

  get(): FilterState {
    return this.state;
  }

  /** Set a filter value. `source` is the chart id for a cross-filter; leave it out for the filter bar or code. */
  set(id: string, value: FilterValue, source?: string): void {
    this.state = { ...this.state, [id]: value };
    if (source && value !== undefined) this.sources.set(id, source);
    else this.sources.delete(id);
    this.emit();
  }

  /** The chart id that set this filter, if a chart set it. */
  sourceOf(id: string): string | undefined {
    return this.sources.get(id);
  }

  /** Clear filters: all of them, or only those that `keep` rejects. */
  reset(keep?: (id: string) => boolean): void {
    this.state = keep ? Object.fromEntries(Object.entries(this.state).filter(([id]) => keep(id))) : {};
    for (const id of [...this.sources.keys()]) if (!(id in this.state)) this.sources.delete(id);
    this.emit();
  }

  subscribe(listener: (s: FilterState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l(this.state);
  }
}
