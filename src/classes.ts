/**
 * Extra class names for the controls the dashboard draws, so they take a design system's look:
 * each value is added to the element's own `d3s-*` class. `button`: Reset, Pause and Clear all.
 * `input`: the search, number and date inputs. `select`: the select filters. `card`: each card.
 */
export interface ControlClasses {
  button?: string;
  input?: string;
  select?: string;
  card?: string;
}

/** Add `extra` (space-separated class names, or nothing) to `e`. */
export function addClasses(e: Element, extra: string | undefined): void {
  const names = extra?.split(/\s+/).filter(Boolean) ?? [];
  if (names.length) e.classList.add(...names);
}
