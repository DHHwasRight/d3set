/** Small DOM helpers for HTML-based views (top list, status, stream). */

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.append(...children);
  return el;
}

/** A scrollable body for an HTML view, at the chart height. */
export function htmlBody(el: HTMLElement, height: number, className: string): HTMLElement {
  el.classList.add("d3s-chart");
  el.style.height = `${height}px`;
  const body = h("div", `d3s-scroll ${className}`);
  el.append(body);
  return body;
}

export const timeFormat = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
