"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { followLibrarySwitch, type Library } from "@d3set/gallery-shared/libraries";
import { followThemeSwitch, syncThemeSwitch } from "@d3set/gallery-shared/theme";

/** A payload not hydrated yet: `hydrate()` replaces the server markup, payload included. */
const PENDING = "[data-d3s-chart] > script.d3s-payload, [data-d3s-dashboard] > script.d3s-payload";

/**
 * `<html data-gallery-ready>`: "true" once every chart and dashboard of the page is hydrated, for
 * the conformity tests; "false" while a page loads. Keyed on the path, so a client navigation
 * starts over.
 */
export function Ready() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    const check = () => {
      const ready = !document.querySelector(PENDING);
      root.dataset.galleryReady = String(ready);
      return ready;
    };
    if (check()) return;
    const observer = new MutationObserver(() => {
      if (check()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}

/** Keep the library switch's links on the page shown now (see `followLibrarySwitch`). */
export function FollowLibrarySwitch({ bases, own }: { bases: Record<Library, string>; own: string }) {
  useEffect(() => followLibrarySwitch(bases, own), [bases, own]);
  return null;
}

/** The theme switch: clicks, and its state on each page (the server renders it unpressed). */
export function FollowThemeSwitch() {
  const pathname = usePathname();
  useEffect(() => followThemeSwitch(), []);
  useEffect(() => syncThemeSwitch(), [pathname]);
  return null;
}
