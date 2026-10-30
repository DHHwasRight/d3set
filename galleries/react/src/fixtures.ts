// The pages exported from the Rust gallery (galleries/shared), loaded on demand: each page is a
// chunk of its own, so the first load downloads one page, not all of them.
import { fixtureName, type Page } from "@d3set/gallery-shared";
import { docs } from "./docs";

const files = import.meta.glob<Page>("../../shared/fixtures/original/*.json", { import: "default" });

/** The page at `path`, or undefined when the gallery has no such page. */
export function loadPage(path: string): Promise<Page> | undefined {
  return files[`../../shared/fixtures/original/${fixtureName(path)}.json`]?.();
}

/**
 * The page's own head: title, `<body>` attributes and its fonts, if any. The fonts load before
 * the page draws, as the preloads make them in the Rust gallery, so text never reflows under a chart.
 */
export async function applyHead(page: Page): Promise<void> {
  document.title = docs.title;
  document.getElementById("page-style")!.textContent = page.headStyle;
  for (const [name, value] of Object.entries(page.bodyAttrs)) document.body.setAttribute(name, value);
  const families = [...page.headStyle.matchAll(/@font-face\s*\{[^}]*font-family:\s*'([^']+)'[^}]*url\(/g)];
  await Promise.all(families.map(([, family]) => document.fonts.load(`1em "${family}"`)));
}
