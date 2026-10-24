/** A numeric range, or a time range with ISO date strings. */
export type RangeValue = { min?: number; max?: number } | { from?: string; to?: string };

/**
 * What a chart can do to the dashboard around it.
 * A chart mounted alone gets `noInteractions`: every call does nothing.
 */
export interface Interactions {
  /**
   * Cross-filter: toggle `value` of `field`. Other charts show only the selected values.
   * The chart that selects keeps all its data and dims the values that are not selected.
   * With `additive` (shift-click), the other selected values stay.
   */
  toggle(field: string, value: string, additive?: boolean): void;
  /** Values of `field` selected by this chart, or undefined when it has no selection on `field`. */
  selection(field: string): ReadonlySet<string> | undefined;
  /** Set a range on `field` for every chart, or clear it with undefined (brush zoom). */
  setRange(field: string, range: RangeValue | undefined): void;
  /** Share the hovered time (ms since epoch) with the other time charts. */
  hoverTime(t: number | undefined): void;
  /** Listen for the time hovered in other charts. Returns an unsubscribe function. */
  onHoverTime(listener: (t: number | undefined) => void): () => void;
}

export const noInteractions: Interactions = {
  toggle() {},
  selection: () => undefined,
  setRange() {},
  hoverTime() {},
  onHoverTime: () => () => {},
};

/** True when a selection exists on the field and does not include `value`. */
export function isDimmed(i: Interactions, field: string | undefined, value: string): boolean {
  if (!field) return false;
  const sel = i.selection(field);
  return sel !== undefined && sel.size > 0 && !sel.has(value);
}
