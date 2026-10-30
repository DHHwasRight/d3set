// The pages exported from the Rust gallery (galleries/shared/fixtures), read on the server only.
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fixtureName, type Page } from "@d3set/gallery-shared";

// `next build` and `next start` run in galleries/next. One design: Original.
const DIR = join(process.cwd(), "../shared/fixtures");

/** Every path the gallery serves. */
export const PATHS: string[] = JSON.parse(readFileSync(join(DIR, "pages.json"), "utf8"));

/** The page at `path`. */
export function readPage(path: string): Page {
  return JSON.parse(readFileSync(join(DIR, "original", `${fixtureName(path)}.json`), "utf8"));
}

/** `/charts/bar` ↔ the catch-all segments `["charts", "bar"]`. */
export function toSegments(path: string): string[] {
  return path === "/" ? [] : path.slice(1).split("/");
}
export function toPath(segments: string[] | undefined): string {
  return `/${(segments ?? []).join("/")}`;
}
