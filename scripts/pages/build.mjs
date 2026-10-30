// Build the GitHub Pages site: the four galleries in one directory, as the host serves it.
//
//   node scripts/pages/build.mjs [--out dist-pages] [--only rsx,vanilla,react,next,fixtures]
//   PAGES_URL=http://localhost:4000/d3set node scripts/pages/build.mjs   (local preview)
//
// Layout of the output, served at PAGES_URL (default https://dhhwasright.github.io/d3set):
//   /            the Rust gallery: pages, partials/<depth>/, data/<feed>.json, assets, 404.html
//   /vanilla/    /react/    /next/    the framework galleries
//
// The framework galleries draw the Rust gallery's pages (fixtures), so the fixtures are exported
// first from a Rust gallery run with a fixed clock.

import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PARTS = ["fixtures", "rsx", "vanilla", "react", "next"];
const NOW = "2026-10-01T00:00:00Z";
const REFERENCE = "127.0.0.1:3140";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const only = arg("only", PARTS.join(",")).split(",");
// A full build goes to a new directory that replaces the old one at the end, so a server keeps
// serving the previous site until then. A partial build updates the site in place.
const full = only.length === PARTS.length;
const final = resolve(root, arg("out", "dist-pages"));
const out = full ? `${final}.new` : final;
for (const part of only) {
  if (!PARTS.includes(part)) {
    console.error(`pages: unknown part "${part}"\nhelp: use some of ${PARTS.join(", ")}`);
    process.exit(2);
  }
}
const site = (process.env.PAGES_URL ?? "https://dhhwasright.github.io/d3set").replace(/\/+$/, "");
const base = new URL(site).pathname.replace(/\/+$/, "");
const libraries = `vanilla=${site}/vanilla,rsx=${site},react=${site}/react,next=${site}/next`;

function run(cmd, args, opts = {}) {
  console.log(`pages: ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${r.status})`);
}

const gallery = join(root, "target/debug/gallery");

async function fixtures() {
  // The reference: the server-mode gallery the framework galleries are checked against.
  const server = spawn(gallery, [], {
    cwd: root,
    env: { ...process.env, GALLERY_ADDR: REFERENCE, GALLERY_NOW: NOW },
    stdio: "ignore",
  });
  try {
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(`http://${REFERENCE}/`)).ok) break;
      } catch {}
      if (i > 100) throw new Error(`the reference gallery did not start on ${REFERENCE}`);
      await new Promise((r) => setTimeout(r, 100));
    }
    run("node", ["galleries/shared/scripts/export.mjs"]);
  } finally {
    server.kill();
  }
}

function rsx() {
  // The export writes into its own directory (emptied first); the framework galleries are copied
  // in after, so `--only rsx` must not delete them: export aside, then merge.
  const tmp = join(root, "target/pages-rsx");
  run(gallery, ["export", "--out", tmp], {
    env: { ...process.env, GALLERY_STATIC: "1", GALLERY_NOW: NOW, GALLERY_BASE: base, GALLERY_LIBRARIES: libraries },
  });
  mkdirSync(out, { recursive: true });
  cpSync(tmp, out, { recursive: true });
}

function framework(name) {
  run("node", ["galleries/shared/scripts/pages.mjs", name], { env: { ...process.env, PAGES_URL: site } });
  const from = join(root, "galleries", name, name === "next" ? "out" : "dist");
  rmSync(join(out, name), { recursive: true, force: true });
  cpSync(from, join(out, name), { recursive: true });
}

const started = Date.now();
rmSync(`${final}.new`, { recursive: true, force: true });
run("cargo", ["build", "-q", "-p", "gallery"]);
if (only.includes("fixtures") || !existsSync(join(root, "galleries/shared/fixtures/pages.json"))) await fixtures();
if (only.includes("rsx")) rsx();
// The galleries bundle the library from dist/: build it once.
if (only.some((p) => ["vanilla", "react", "next"].includes(p))) run("npm", ["run", "build", "--silent"]);
for (const name of ["vanilla", "react", "next"]) if (only.includes(name)) framework(name);
if (full) {
  rmSync(final, { recursive: true, force: true });
  renameSync(out, final);
}
console.log(`pages: ${final} for ${site} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
