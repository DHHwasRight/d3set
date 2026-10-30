"use client";

import { useEffect, useRef } from "react";

export interface HydrateProps {
  /** Markup from `renderChart` or `renderDashboard` (d3set/server), with its payload. */
  html: string;
  className?: string;
}

/**
 * Server markup, made live in the browser: the chart types it uses load on demand, then
 * `hydrate()` replaces the markup with live charts. React does not touch the markup itself.
 */
export function Hydrate({ html, className }: HydrateProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let alive = true;
    let destroy: (() => void) | undefined;
    void Promise.all([import("d3set/core"), import("d3set/lazy")]).then(async ([core, lazy]) => {
      const el = ref.current;
      if (!alive || !el) return;
      await lazy.loadChartsFor(el);
      if (!alive) return;
      destroy = core.hydrate(el).destroy;
    });
    return () => {
      alive = false;
      destroy?.();
    };
  }, [html]);
  return (
    <div ref={ref} className={className} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
