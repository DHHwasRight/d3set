"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Run `mount` on the element once the chart types it needs are loaded, and `unmount` on cleanup
 * or when `key` changes. `types` load on demand (`d3set/lazy`), so an app ships only the chart
 * types its components use. Everything `mount` creates belongs to that mount: React's StrictMode
 * double effects get two independent mounts, never a closed leftover.
 */
export function useMounted<T>(
  key: string,
  types: string[],
  mount: (el: HTMLElement) => T,
  unmount: (handle: T) => void,
  onReady?: () => void,
): { ref: RefObject<HTMLElement | null>; handle: RefObject<T | undefined> } {
  const ref = useRef<HTMLElement | null>(null);
  const handle = useRef<T | undefined>(undefined);
  const latest = useRef({ mount, unmount, onReady });
  latest.current = { mount, unmount, onReady };

  useEffect(() => {
    let alive = true;
    let mine: T | undefined;
    void import("d3set/lazy")
      .then(({ loadCharts }) => loadCharts(types))
      .then(() => {
        if (!alive || !ref.current) return;
        mine = latest.current.mount(ref.current);
        handle.current = mine;
        latest.current.onReady?.();
      });
    return () => {
      alive = false;
      if (mine !== undefined) latest.current.unmount(mine);
      if (handle.current === mine) handle.current = undefined;
    };
    // `key` stands for everything `mount` reads that needs a fresh chart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ref, handle };
}
