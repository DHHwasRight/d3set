// Build one framework gallery for GitHub Pages: under its path prefix, with the charts polling the
// Rust gallery's static data files and the library switch pointing at the published galleries.
//
//   node galleries/shared/scripts/pages.mjs vanilla|react|next
//   PAGES_URL=https://example.github.io/d3set node … (default: the d3set project page)
//
// Vanilla and React are single-page apps: every page gets a copy of index.html at its own path, so
// a direct load works on a static host, and 404.html is one more copy. Next.js exports every page
// itself (output: "export"). Output: galleries/<name>/dist or galleries/next/out.

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GALLERIES = ["vanilla", "react", "next"];
const name = process.argv[2];
if (!GALLERIES.includes(name)) {
  console.error(`pages: unknown gallery "${name ?? ""}"\nhelp: pass one of ${GALLERIES.join(", ")}`);
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "../..", name);
const site = (process.env.PAGES_URL ?? "https://dhhwasright.github.io/d3set").replace(/\/+$/, "");
// The path of the site on its host: `/d3set`. The Rust gallery is at its root, with data/.
const root = new URL(site).pathname.replace(/\/+$/, "");

const env = {
  ...process.env,
  GALLERY_BASE: `${root}/${name}`,
  GALLERY_STATIC: "1",
  GALLERY_DATA_BASE: root,
  GALLERY_LIBRARIES: `vanilla=${site}/vanilla,rsx=${site},react=${site}/react,next=${site}/next`,
};
const built = spawnSync("npm", ["run", "build"], { cwd: dir, env, stdio: "inherit" });
if (built.status !== 0) process.exit(built.status ?? 1);

if (name === "next") {
  console.log(`pages: ${join(dir, "out")} (${env.GALLERY_BASE})`);
} else {
  const out = join(dir, "dist");
  const index = join(out, "index.html");
  const paths = JSON.parse(readFileSync(join(here, "../fixtures/pages.json"), "utf8"));
  for (const path of paths.filter((p) => p !== "/")) {
    mkdirSync(join(out, path), { recursive: true });
    copyFileSync(index, join(out, path, "index.html"));
  }
  // An unknown path, on hosts that read a 404.html per directory (GitHub Pages reads only the
  // site root one, the Rust gallery's): the app draws its own "not found" page.
  copyFileSync(index, join(out, "404.html"));
  console.log(`pages: ${out} (${env.GALLERY_BASE}, ${paths.length} pages)`);
}
